import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonAuditHistory } from "./lesson-audit-history";

function renderHistory(rpc: ReturnType<typeof vi.fn>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LessonAuditHistory academyId="academy-1" date="2026-10-16" lessonKind="academy" client={{ rpc }} />
    </QueryClientProvider>,
  );
}

describe("레슨 날짜별 읽기 전용 변경 이력", () => {
  it("변경 시각·대상·사유를 보여주고 수정 동작은 제공하지 않는다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "audit-1", occurred_at: "2026-10-16T15:02:00Z", event_type: "lesson_event.deleted", student_name: "김민지", reason: "일정 취소", resolution: null }],
      error: null,
    });
    renderHistory(rpc);

    await screen.findByText("일정 삭제");
    const history = screen.getByRole("region", { name: "변경 이력" });
    expect(history).toHaveTextContent("일정 삭제");
    expect(history).toHaveTextContent("김민지");
    expect(history).toHaveTextContent("일정 취소");
    expect(history).toHaveTextContent("10월 17일 00:02");
    expect(history.querySelector("button")).toBeNull();
  });

  it("이력이 없으면 빈 상태를 안내한다", async () => {
    renderHistory(vi.fn().mockResolvedValue({ data: [], error: null }));
    expect(await screen.findByText("이날 변경 이력이 없습니다.")).toBeInTheDocument();
  });

  it("권한 오류에는 안내를 표시하고 감사 로그 원문은 숨긴다", async () => {
    renderHistory(vi.fn().mockResolvedValue({ data: null, error: new Error("permission denied for table audit_events") }));
    expect(await screen.findByText("이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.")).toBeInTheDocument();
    expect(screen.queryByText(/audit_events/)).toBeNull();
  });

  it("일시적인 조회 실패 후 다시 시도할 수 있다", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: new Error("network request failed") })
      .mockResolvedValueOnce({ data: [], error: null });
    renderHistory(rpc);
    await screen.findByRole("alert");

    await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("이날 변경 이력이 없습니다.")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
