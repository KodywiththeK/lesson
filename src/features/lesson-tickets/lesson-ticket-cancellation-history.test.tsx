import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LessonTicketCancellationHistory } from "./lesson-ticket-cancellation-history";

describe("회차권 사용취소 이력", () => {
  it("과거에 알 수 없는 항목은 추측하지 않고 표시한다", async () => {
    const row = { id: "old", mode: "refund", student_name: "김민지", instrument_name: null,
      total_count: 4, remaining_count: 2, registered_at: null, valid_until: null, refund_amount: 0, occurred_at: "2026-09-01T00:00:00Z" };
    const query = { eq: vi.fn(), order: vi.fn(), range: vi.fn() };
    query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [row], error: null });
    const client = { from: () => ({ select: () => query }) };
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LessonTicketCancellationHistory academyId="a" client={client} search="김민지" page={1} pageSize={10}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
    </QueryClientProvider>);
    expect(await screen.findByText("김민지")).toBeInTheDocument();
    expect(screen.getAllByText("알 수 없음")).toHaveLength(3);
    expect(screen.getByText("환불")).toBeInTheDocument();
    expect(query.eq).toHaveBeenCalledWith("academy_id", "a");
  });
});
