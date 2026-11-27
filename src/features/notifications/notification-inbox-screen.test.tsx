import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { InboxNotification } from "@/lib/api/notification-inbox";

import { NotificationInboxScreen, type NotificationInboxDataAccess } from "./notification-inbox-screen";

const notifications: InboxNotification[] = [
  {
    id: "n1",
    kind: "lesson_change",
    title: "내일 레슨 변경",
    body: "유나 15:00 → 16:00",
    url: "/lessons/academy",
    createdAt: "2026-11-27T13:30:00.000Z",
    readAt: null,
  },
  {
    id: "n2",
    kind: "consultation",
    title: "신규 상담 접수",
    body: "새봄 상담이 등록되었습니다.",
    url: "/management/consultations",
    createdAt: "2026-11-26T02:00:00.000Z",
    readAt: "2026-11-26T03:00:00.000Z",
  },
];

function renderInbox(items = notifications) {
  const dataAccess: NotificationInboxDataAccess = {
    load: vi.fn(async () => items),
    markRead: vi.fn(async () => undefined),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationInboxScreen academyId="academy-1" dataAccess={dataAccess} />
    </QueryClientProvider>,
  );
  return dataAccess;
}

describe("NotificationInboxScreen", () => {
  it("최근 알림을 최신순으로 보여 주고, 누르면 해당 화면으로 가며 안 읽은 알림을 표시한다", async () => {
    renderInbox();

    const list = await screen.findByRole("list", { name: "받은 알림" });
    const items = within(list).getAllByRole("listitem");
    expect(within(items[0]).getByRole("link", { name: /내일 레슨 변경/ })).toHaveAttribute("href", "/lessons/academy");
    expect(within(items[0]).getByText("유나 15:00 → 16:00")).toBeInTheDocument();
    expect(within(items[0]).getByText("11월 27일 22:30")).toBeInTheDocument();
    expect(within(items[0]).getByText("새 알림")).toBeInTheDocument();
    expect(within(items[1]).queryByText("새 알림")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "알림 설정" })).toHaveAttribute("href", "/me/notifications");
  });

  it("알림함을 열면 모두 읽음으로 바꾼다", async () => {
    const dataAccess = renderInbox();

    await waitFor(() => expect(dataAccess.markRead).toHaveBeenCalledTimes(1));
  });

  it("알림이 없으면 빈 안내를 보여 준다", async () => {
    renderInbox([]);

    expect(await screen.findByText("최근 30일 동안 받은 알림이 없습니다.")).toBeInTheDocument();
  });
});
