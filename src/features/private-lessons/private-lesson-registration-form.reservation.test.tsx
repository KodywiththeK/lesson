import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrivateLessonRegistrationForm } from "./private-lesson-registration-form";

describe("개인레슨 일정 등록 예약", () => {
  it("휴원일에는 이름을 보여 주고 추가 확인 전에는 등록을 막는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><PrivateLessonRegistrationForm
      academyId="a1" initialDate="2026-10-20"
      options={{ students: [{ studentId: "s1", studentName: "김민지", instruments: [{ studentInstrumentId: "si1", instrumentId: "piano", instrumentName: "피아노", lessonMinutes: 40 }] }], teachers: [{ teacherId: "t1", teacherName: "박선생", part: "피아노" }] }}
      fetchAvailability={async () => [{ studentId: "s1", instrumentId: "piano", remainingCount: 4, reservedCount: 0, availableCount: 4 }]}
      closures={[{ id: "c1", title: "정기 휴원", startsOn: "2026-10-20", endsOn: "2026-10-20", weekday: null, active: true }]}
      isLoading={false} error={null} isSaving={false} onSubmit={onSubmit} onCancel={vi.fn()}
    /></QueryClientProvider>);
    expect(screen.getByText(/정기 휴원/)).toBeInTheDocument();
    await screen.findByRole("option", { name: "피아노" });
    await user.selectOptions(screen.getByLabelText("악기"), "piano");
    await user.selectOptions(screen.getByLabelText("원생"), "s1");
    await user.click(screen.getByRole("button", { name: "완료" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: /휴원일.*확인/ })).toBeInTheDocument();
  });
  it("날짜·악기 다음에 예약 가능한 원생만 표시하고 실제 잔여와 예약 가능 수를 분리한다", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PrivateLessonRegistrationForm
          academyId="academy-1"
          initialDate="2026-10-20"
          options={{
            students: [
              { studentId: "s1", studentName: "김민지", instruments: [{ studentInstrumentId: "si1", instrumentId: "piano", instrumentName: "피아노", lessonMinutes: 40 }] },
              { studentId: "s2", studentName: "이서윤", instruments: [{ studentInstrumentId: "si2", instrumentId: "piano", instrumentName: "피아노", lessonMinutes: 40 }] },
            ],
            teachers: [{ teacherId: "t1", teacherName: "박선생", part: "피아노" }],
          }}
          fetchAvailability={async () => [
            { studentId: "s1", instrumentId: "piano", remainingCount: 4, reservedCount: 1, availableCount: 3 },
            { studentId: "s2", instrumentId: "piano", remainingCount: 0, reservedCount: 0, availableCount: 0 },
          ]}
          isLoading={false}
          error={null}
          isSaving={false}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("날짜")).toHaveValue("2026-10-20");
    await screen.findByRole("option", { name: "피아노" });
    await user.selectOptions(screen.getByLabelText("악기"), "piano");
    expect(await screen.findByRole("option", { name: "김민지 · 예약 가능 3회 · 실제 잔여 4회" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "이서윤" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("원생"), "s1");
    expect(screen.getByText(/실제 잔여 4회.*예약 1회.*예약 가능 3회/)).toBeInTheDocument();
  });

  it("예약 가능 회차가 없으면 악기를 고를 수 없고 회차권 등록·입금대기 전환을 안내한다(외상 예정 없음)", async () => {
    render(<QueryClientProvider client={new QueryClient()}><PrivateLessonRegistrationForm
      academyId="a1" initialDate="2026-10-20" isLoading={false} error={null} isSaving={false}
      options={{ students: [{ studentId: "s1", studentName: "김민지", instruments: [{ studentInstrumentId: "si1", instrumentId: "piano", instrumentName: "피아노", lessonMinutes: 40 }] }], teachers: [{ teacherId: "t1", teacherName: "박선생", part: "피아노" }] }}
      fetchAvailability={async () => []} onSubmit={vi.fn()} onCancel={vi.fn()}
    /></QueryClientProvider>);

    expect(await screen.findByText("선택한 날짜에 예약 가능한 회차권이 없습니다. 회차권을 등록하고 입금대기로 바꾼 뒤 다시 시도해 주세요.")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "피아노" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "외상 예정으로 등록" })).not.toBeInTheDocument();
  });
});
