import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_NOTIFICATION_PREFERENCES, type PushEnvironment } from "@/domain/notification-settings";
import type { AcademyRole } from "@/domain/permissions";

import {
  NotificationSettingsScreen,
  type NotificationDevice,
  type NotificationSettingsDataAccess,
} from "./notification-settings-screen";

const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: toastMock }));

const desktopChrome: PushEnvironment = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default",
  isIos: false,
  isStandalone: false,
};

function renderScreen({
  role = "owner",
  environment = desktopChrome,
  endpoint = null,
}: {
  role?: AcademyRole;
  environment?: PushEnvironment;
  endpoint?: string | null;
} = {}) {
  let preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const dataAccess: NotificationSettingsDataAccess = {
    loadSettings: vi.fn(async () => ({ email: "owner@example.com", preferences })),
    savePreferences: vi.fn(async (next) => {
      preferences = next;
    }),
    saveSubscription: vi.fn(async () => undefined),
    deleteSubscription: vi.fn(async () => undefined),
    sendTest: vi.fn(async () => undefined),
  };
  let currentEndpoint = endpoint;
  const device: NotificationDevice = {
    readEnvironment: () => environment,
    getEndpoint: vi.fn(async () => currentEndpoint),
    subscribe: vi.fn(async () => {
      currentEndpoint = "https://push.example/this-device";
      return { endpoint: currentEndpoint, p256dh: "p", auth: "a" };
    }),
    unsubscribe: vi.fn(async () => {
      const removed = currentEndpoint;
      currentEndpoint = null;
      return removed;
    }),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <NotificationSettingsScreen academyId="academy-1" role={role} dataAccess={dataAccess} device={device} />
    </QueryClientProvider>,
  );

  return { dataAccess, device };
}

describe("NotificationSettingsScreen", () => {
  it("원장은 아침 메일(받는 주소 표시)과 푸시 네 가지를 켜고 끌 수 있다", async () => {
    renderScreen();

    const items = await screen.findByRole("region", { name: "받을 알림" });
    expect((await within(items).findAllByRole("switch")).map((item) => item.getAttribute("aria-label"))).toEqual([
      "아침 브리핑 메일",
      "오늘 레슨 변경",
      "신규 상담 접수",
      "직원 가입 요청",
      "아침 브리핑 한 줄",
    ]);
    expect(within(items).getByText(/owner@example.com/)).toBeInTheDocument();
  });

  it("선생님은 메일 없이 레슨 변경과 아침 브리핑 푸시만 설정한다", async () => {
    renderScreen({ role: "teacher" });

    const items = await screen.findByRole("region", { name: "받을 알림" });
    expect((await within(items).findAllByRole("switch")).map((item) => item.getAttribute("aria-label"))).toEqual([
      "오늘 레슨 변경",
      "아침 브리핑 한 줄",
    ]);
  });

  it("항목을 끄면 바뀐 값으로 바로 저장한다", async () => {
    const user = userEvent.setup();
    const { dataAccess } = renderScreen();

    await user.click(await screen.findByRole("switch", { name: "신규 상담 접수" }));

    await waitFor(() =>
      expect(dataAccess.savePreferences).toHaveBeenCalledWith({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        pushConsultation: false,
      }),
    );
  });

  it("이 기기에서 알림을 켜면 구독을 저장하고, 테스트 알림을 보낼 수 있다", async () => {
    const user = userEvent.setup();
    const { dataAccess, device } = renderScreen();

    await user.click(await screen.findByRole("button", { name: "이 기기에서 알림 켜기" }));

    expect(device.subscribe).toHaveBeenCalled();
    await waitFor(() =>
      expect(dataAccess.saveSubscription).toHaveBeenCalledWith({
        endpoint: "https://push.example/this-device",
        p256dh: "p",
        auth: "a",
      }),
    );
    expect(await screen.findByText("이 기기에서 알림을 받고 있습니다.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "테스트 알림 보내기" }));
    expect(dataAccess.sendTest).toHaveBeenCalled();
  });

  it("이 기기 알림을 끄면 구독을 해제하고 서버에서도 지운다", async () => {
    const user = userEvent.setup();
    const { dataAccess } = renderScreen({
      environment: { ...desktopChrome, permission: "granted" },
      endpoint: "https://push.example/this-device",
    });

    await user.click(await screen.findByRole("button", { name: "이 기기 알림 끄기" }));

    await waitFor(() => expect(dataAccess.deleteSubscription).toHaveBeenCalledWith("https://push.example/this-device"));
    expect(await screen.findByRole("button", { name: "이 기기에서 알림 켜기" })).toBeInTheDocument();
  });

  it("아이폰 사파리에서는 켜기 버튼 대신 홈 화면에 추가하라고 안내한다", async () => {
    renderScreen({ environment: { ...desktopChrome, isIos: true, hasPushManager: false } });

    expect(
      await screen.findByText(/아이폰·아이패드는 홈 화면에 추가한 앱에서만 알림을 받을 수 있습니다/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이 기기에서 알림 켜기" })).not.toBeInTheDocument();
    const install = screen.getByRole("region", { name: "앱 설치" });
    expect(within(install).getByText(/공유/)).toBeInTheDocument();
    expect(within(install).getByText(/홈 화면에 추가/)).toBeInTheDocument();
  });

  it("알림을 차단했으면 설정에서 허용하라고 안내한다", async () => {
    renderScreen({ environment: { ...desktopChrome, permission: "denied" } });

    expect(await screen.findByText(/알림이 차단되어 있습니다/)).toBeInTheDocument();
  });
});
