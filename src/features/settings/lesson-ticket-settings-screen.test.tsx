import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LessonTicketRefundPolicy } from "@/domain/lesson-ticket-refund";
import { queryKeys } from "@/lib/api/query-keys";

import { LessonTicketSettingsScreen } from "./lesson-ticket-settings-screen";

const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));

vi.mock("sonner", () => ({ toast: toastMock }));

function renderScreen({
  policy = "none",
  loadError,
  savePolicy = vi.fn().mockResolvedValue(undefined),
}: {
  policy?: LessonTicketRefundPolicy;
  loadError?: Error;
  savePolicy?: (policy: LessonTicketRefundPolicy) => Promise<void>;
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <LessonTicketSettingsScreen
        academyId="academy-1"
        queryOptions={{
          queryKey: queryKeys.settings.lessonTicketRefundPolicy("academy-1"),
          queryFn: async () => {
            if (loadError) throw loadError;
            return policy;
          },
        }}
        savePolicy={savePolicy}
      />
    </QueryClientProvider>,
  );

  return { savePolicy };
}

describe("LessonTicketSettingsScreen", () => {
  beforeEach(() => {
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  it("환불 규정 세 가지를 라디오로 보여 주고 저장된 규정을 선택해 둔다", async () => {
    renderScreen({ policy: "proportional_until_half" });

    const group = await screen.findByRole("radiogroup", { name: "회차권 환불 규정" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.getAttribute("aria-label") ?? radio.id)).toHaveLength(3);
    expect(within(group).getByRole("radio", { name: /언제든 남은 회수 비례 환불/ })).not.toBeChecked();
    expect(within(group).getByRole("radio", { name: /반 이하 사용 시에만 남은 회수 비례 환불/ })).toBeChecked();
    expect(within(group).getByRole("radio", { name: /환불 불가/ })).not.toBeChecked();
  });

  it("설정하지 않은 학원은 환불 불가가 선택되어 있다", async () => {
    renderScreen();

    expect(await screen.findByRole("radio", { name: /환불 불가/ })).toBeChecked();
  });

  it("바꾸기 전에는 저장할 수 없고, 바꾼 규정을 저장하면 안내한다", async () => {
    const user = userEvent.setup();
    const { savePolicy } = renderScreen();

    const save = await screen.findByRole("button", { name: "저장" });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /언제든 남은 회수 비례 환불/ }));
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(savePolicy).toHaveBeenCalledWith("proportional_always"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("회차권 환불 규정을 저장했습니다."));
  });

  it("저장에 실패하면 사유와 함께 알리고 선택은 그대로 둔다", async () => {
    const user = userEvent.setup();
    renderScreen({ savePolicy: vi.fn().mockRejectedValue(new Error("회차권 환불 규정을 저장하지 못했습니다: 원장만 바꿀 수 있습니다.")) });

    await user.click(await screen.findByRole("radio", { name: /언제든 남은 회수 비례 환불/ }));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("회차권 환불 규정 저장에 실패했습니다.", expect.anything()));
    expect(screen.getByRole("radio", { name: /언제든 남은 회수 비례 환불/ })).toBeChecked();
  });

  it("규정을 불러오지 못하면 안내를 보여 주고 저장을 막는다", async () => {
    renderScreen({ loadError: new Error("permission denied") });

    expect(await screen.findByText("회차권 환불 규정을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "저장" })).not.toBeInTheDocument();
  });

  it("삭제 때 무엇이 일어나는지 안내한다", async () => {
    renderScreen();

    expect(await screen.findByText(/회차권을 삭제할 때 적용됩니다/)).toBeInTheDocument();
  });
});
