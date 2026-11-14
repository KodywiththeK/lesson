import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrivateLessonEditDialog } from "./private-lesson-edit-dialog";

describe("개인레슨 일정 수정", () => {
  it("휴원일로 이동할 때 이름을 알리고 추가 확인을 요구한다", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PrivateLessonEditDialog
      lesson={{ id: "e1", academyId: "a1", studentId: "s1", studentName: "김민지", instrumentId: "piano", instrumentName: "피아노", teacherId: "t1", teacherName: "박선생", startAt: "2026-10-20T14:00:00+09:00", endAt: "2026-10-20T14:40:00+09:00", status: "scheduled" }}
      teachers={[{ teacherId: "t1", teacherName: "박선생", part: "피아노" }]}
      initialDate="2026-10-21"
      closures={[{ id: "c1", title: "학원 휴원", startsOn: "2026-10-21", endsOn: "2026-10-21", weekday: null, active: true }]}
      isSaving={false} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()}
    />);
    expect(screen.getByText(/학원 휴원/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: /휴원일.*확인/ }));
    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(onSave).toHaveBeenCalledOnce();
  });
  it("DB에서 UTC 표기로 읽은 일정도 한국 시간 그대로 저장 시각을 만든다", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PrivateLessonEditDialog
      lesson={{ id: "e1", academyId: "a1", studentId: "s1", studentName: "김민지",
        instrumentId: "piano", instrumentName: "피아노", teacherId: "t1", teacherName: "박선생",
        startAt: "2026-10-20T05:00:00+00:00", endAt: "2026-10-20T05:40:00+00:00", status: "scheduled" }}
      teachers={[{ teacherId: "t1", teacherName: "박선생", part: "피아노" }]}
      isSaving={false} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()}
    />);
    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ startAt: "2026-10-20T14:00:00+09:00", endAt: "2026-10-20T14:40:00+09:00" }),
    );
  });
  it("날짜·시간·선생님과 선택 사유를 수정하고 삭제 확인에는 사유를 묻지 않는다", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PrivateLessonEditDialog
      lesson={{ id: "e1", academyId: "a1", studentId: "s1", studentName: "김민지",
        instrumentId: "piano", instrumentName: "피아노", teacherId: "t1", teacherName: "박선생",
        startAt: "2026-10-20T14:00:00+09:00", endAt: "2026-10-20T14:40:00+09:00", status: "scheduled" }}
      teachers={[{ teacherId: "t1", teacherName: "박선생", part: "피아노" }]}
      isSaving={false} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()}
    />);
    expect(screen.getByRole("dialog", { name: "개인레슨 일정 수정" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ reason: "", teacherId: "t1" }));
    await user.click(screen.getByRole("button", { name: "일정 삭제" }));
    expect(screen.getByRole("alertdialog", { name: "개인레슨 일정을 삭제할까요?" })).toBeInTheDocument();
    expect(screen.queryByLabelText("삭제 사유")).not.toBeInTheDocument();
  });
});

describe("개인레슨 일정 수정 — 등록 화면과 같은 구성", () => {
  const lesson = {
    id: "e1", academyId: "a1", studentId: "s1", studentName: "김민지",
    instrumentId: "piano", instrumentName: "피아노", teacherId: "t1", teacherName: "박선생",
    startAt: "2026-10-20T14:00:00+09:00", endAt: "2026-10-20T14:40:00+09:00", status: "scheduled" as const,
  };
  const teachers = [
    { teacherId: "t1", teacherName: "박선생", part: "피아노" },
    { teacherId: "t2", teacherName: "오선생", part: "피아노" },
    { teacherId: "t3", teacherName: "최선생", part: "첼로" },
  ];

  it("등록과 같은 순서(날짜·악기·원생·선생님·시간)로 보여 주고 원생·악기는 회차권에 묶여 바꿀 수 없다", () => {
    render(<PrivateLessonEditDialog lesson={lesson} teachers={teachers}
      isSaving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    const steps = screen.getByRole("list", { name: "개인레슨 일정 수정 단계" });
    expect(steps).toHaveTextContent("날짜악기원생선생님시간");
    expect(screen.getByLabelText("수정 날짜")).toHaveValue("2026-10-20");
    expect(screen.getByLabelText("악기")).toHaveValue("피아노");
    expect(screen.getByLabelText("악기")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("원생")).toHaveValue("김민지");
    expect(screen.getByLabelText("원생")).toHaveAttribute("readonly");
    expect(screen.getByText("원생과 악기는 연결된 회차권 때문에 바꿀 수 없습니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("레슨 시간(분)")).toHaveValue(40);
    expect(screen.getByLabelText("종료 시간")).toHaveValue("14:40");
  });

  it("레슨 시간이 범위를 벗어나면 이유를 알리고 저장을 막는다", async () => {
    const user = userEvent.setup();
    render(<PrivateLessonEditDialog lesson={lesson} teachers={teachers}
      isSaving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    await user.clear(screen.getByLabelText("레슨 시간(분)"));
    await user.type(screen.getByLabelText("레슨 시간(분)"), "300");

    expect(screen.getByLabelText("레슨 시간(분)")).toHaveAccessibleDescription("레슨 시간은 5~240분 사이 정수로 입력해 주세요.");
    expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled();
  });

  it("선생님 선택지는 등록처럼 악기 담당 선생님만 보여 준다", () => {
    render(<PrivateLessonEditDialog lesson={lesson} teachers={teachers}
      isSaving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["박선생 / 피아노", "오선생 / 피아노"]);
  });

  it("레슨 시간(분)을 바꾸면 종료 시간이 다시 계산되고 저장에 반영된다", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PrivateLessonEditDialog lesson={lesson} teachers={teachers}
      isSaving={false} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);

    await user.clear(screen.getByLabelText("레슨 시간(분)"));
    await user.type(screen.getByLabelText("레슨 시간(분)"), "50");
    expect(screen.getByLabelText("종료 시간")).toHaveValue("14:50");

    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ startAt: "2026-10-20T14:00:00+09:00", endAt: "2026-10-20T14:50:00+09:00" }),
    );
  });

  it("레슨 시간이 범위를 벗어나면 저장할 수 없다", async () => {
    const user = userEvent.setup();
    render(<PrivateLessonEditDialog lesson={lesson} teachers={teachers}
      isSaving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    await user.clear(screen.getByLabelText("레슨 시간(분)"));
    await user.type(screen.getByLabelText("레슨 시간(분)"), "0");

    expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled();
  });

  it("같은 선생님의 다른 원생 레슨과 시간이 겹치면 등록처럼 알리고 저장을 막는다(자기 일정은 겹침으로 보지 않는다)", async () => {
    const user = userEvent.setup();
    const other = { ...lesson, id: "e2", studentId: "s2", studentName: "이서윤",
      startAt: "2026-10-20T15:00:00+09:00", endAt: "2026-10-20T15:40:00+09:00" };
    render(<PrivateLessonEditDialog lesson={lesson} teachers={teachers} existingLessons={[lesson, other]}
      isSaving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("수정 시작 시간"));
    await user.type(screen.getByLabelText("수정 시작 시간"), "15:10");
    await user.tab();

    expect(screen.getByRole("alert")).toHaveTextContent("이미 같은 시간대에 이서윤 원생 레슨이 있습니다.");
    expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled();
  });
});
