import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import type { StudentPresenceRecord } from "@/domain/student-presence";

import { StudentPresencePanel } from "./student-presence-panel";

function record(overrides: Partial<StudentPresenceRecord> = {}): StudentPresenceRecord {
  return {
    studentId: "student-1",
    studentName: "김민지",
    lessonKinds: ["academy"],
    firstStartAt: "2026-11-14T15:00:00+09:00",
    arrivedAt: null,
    leftAt: null,
    ...overrides,
  };
}

function renderPanel(props: Partial<ComponentProps<typeof StudentPresencePanel>> = {}) {
  const onAction = vi.fn();
  render(
    <StudentPresencePanel
      records={[record()]}
      canManage
      canRecord
      isLoading={false}
      isBusy={false}
      onAction={onAction}
      {...props}
    />,
  );

  return { onAction, user: userEvent.setup() };
}

describe("StudentPresencePanel", () => {
  it("제목과 상태별 인원 요약, 학생의 수업 종류와 상태를 보여 준다", () => {
    renderPanel({
      records: [
        record({ lessonKinds: ["academy", "private"] }),
        record({ studentId: "s2", studentName: "이서윤", arrivedAt: "2026-11-14T06:02:00Z" }),
        record({ studentId: "s3", studentName: "박지호", arrivedAt: "2026-11-14T05:00:00Z", leftAt: "2026-11-14T06:40:00Z" }),
      ],
    });

    expect(screen.getByRole("heading", { name: "등하원 현황" })).toBeInTheDocument();
    expect(screen.getByText("등원 전 1명")).toBeInTheDocument();
    expect(screen.getByText("학원에 있음 1명")).toBeInTheDocument();
    expect(screen.getByText("하원 1명")).toBeInTheDocument();

    const first = screen.getByRole("listitem", { name: /김민지/ });
    expect(within(first).getByText("학원레슨")).toBeInTheDocument();
    expect(within(first).getByText("개인레슨")).toBeInTheDocument();
    expect(within(first).getByText("등원 전")).toBeInTheDocument();
  });

  it("등원한 학생에게는 등원 시각을, 하원한 학생에게는 등원·하원 시각을 한국 시간으로 보여 준다", () => {
    renderPanel({
      records: [
        record({ studentId: "s2", studentName: "이서윤", arrivedAt: "2026-11-14T06:02:00Z" }),
        record({ studentId: "s3", studentName: "박지호", arrivedAt: "2026-11-14T05:00:00Z", leftAt: "2026-11-14T06:40:00Z" }),
      ],
    });

    const present = screen.getByRole("listitem", { name: /이서윤/ });
    expect(within(present).getByText("학원에 있음")).toBeInTheDocument();
    expect(within(present).getByText("등원 15:02")).toBeInTheDocument();

    const left = screen.getByRole("listitem", { name: /박지호/ });
    expect(within(left).getByText("등원 14:00 · 하원 15:40")).toBeInTheDocument();
  });

  it("상태에 맞는 버튼만 보여 주고 누르면 학생과 동작을 넘긴다", async () => {
    const { onAction, user } = renderPanel({
      records: [
        record(),
        record({ studentId: "s2", studentName: "이서윤", arrivedAt: "2026-11-14T06:02:00Z" }),
        record({ studentId: "s3", studentName: "박지호", arrivedAt: "2026-11-14T05:00:00Z", leftAt: "2026-11-14T06:40:00Z" }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "김민지 등원" }));
    await user.click(screen.getByRole("button", { name: "이서윤 하원" }));
    await user.click(screen.getByRole("button", { name: "박지호 하원 취소" }));

    expect(onAction.mock.calls).toEqual([
      ["student-1", "arrive"],
      ["s2", "leave"],
      ["s3", "cancel-leave"],
    ]);
    expect(screen.getByRole("button", { name: "이서윤 등원 취소" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "김민지 하원" })).not.toBeInTheDocument();
  });

  it("선생님처럼 관리 권한이 없으면 버튼 없이 읽기 전용으로 보여 준다", () => {
    renderPanel({ canManage: false });

    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("오늘이 아닌 날짜에는 기록 버튼을 숨기고 이유를 알린다", () => {
    renderPanel({ canRecord: false });

    expect(screen.queryByRole("button", { name: /등원|하원/ })).not.toBeInTheDocument();
    expect(screen.getByText("등하원은 오늘 날짜에만 기록할 수 있습니다.")).toBeInTheDocument();
  });

  it("처리 중에는 버튼을 막고, 학생이 없으면 안내하며, 불러오는 중·실패도 알린다", () => {
    const { unmount } = render(
      <StudentPresencePanel records={[record()]} canManage canRecord isLoading={false} isBusy onAction={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "김민지 등원" })).toBeDisabled();
    unmount();

    const empty = render(
      <StudentPresencePanel records={[]} canManage canRecord isLoading={false} isBusy={false} onAction={vi.fn()} />,
    );
    expect(screen.getByText("이 날짜에 오기로 한 학생이 없습니다.")).toBeInTheDocument();
    empty.unmount();

    const loading = render(
      <StudentPresencePanel records={[]} canManage canRecord isLoading isBusy={false} onAction={vi.fn()} />,
    );
    expect(screen.getByText("등하원 현황을 불러오는 중입니다.")).toBeInTheDocument();
    loading.unmount();

    render(
      <StudentPresencePanel
        records={[]}
        canManage
        canRecord
        isLoading={false}
        isBusy={false}
        loadErrorMessage="등하원 현황을 불러오지 못했습니다."
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("등하원 현황을 불러오지 못했습니다.");
  });
});
