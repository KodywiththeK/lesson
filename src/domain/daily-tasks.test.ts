import { describe, expect, it } from "vitest";

import {
  buildDailyTasks,
  splitDailyTasksByState,
  type DailyTaskSource,
} from "./daily-tasks";

const today = "2026-11-19";

function emptySource(overrides: Partial<DailyTaskSource> = {}): DailyTaskSource {
  return {
    unresolvedAbsences: [],
    tuitions: [],
    lessonTickets: [],
    unpaidBookReleases: [],
    lessonChanges: [],
    consultations: [],
    pendingBookOrders: [],
    ...overrides,
  };
}

const source = emptySource({
  unresolvedAbsences: [
    {
      attendanceId: "att-1",
      lessonDate: "2026-11-18",
      studentId: "stu-yuna",
      studentName: "유나",
      teacherIds: ["teacher-kim"],
      instrumentName: "바이올린",
    },
  ],
  tuitions: [
    {
      snapshotId: "tui-1",
      studentName: "단율",
      instrumentName: "피아노",
      month: "2026-11",
      dueOn: "2026-11-10",
      status: "unpaid",
      amount: 150000,
    },
    {
      snapshotId: "tui-future",
      studentName: "미래",
      instrumentName: "피아노",
      month: "2026-11",
      dueOn: "2026-11-25",
      status: "unpaid",
      amount: 150000,
    },
  ],
  lessonTickets: [
    {
      grantId: "grant-pay",
      studentName: "하린",
      instrumentName: "첼로",
      paymentStatus: "payment-pending",
      dueOn: "2026-11-19",
      remainingCount: 8,
      validUntil: "2027-01-31",
      amount: 320000,
    },
    {
      grantId: "grant-low",
      studentName: "서준",
      instrumentName: "피아노",
      paymentStatus: "paid",
      dueOn: "2026-10-01",
      remainingCount: 1,
      validUntil: "2026-12-31",
      amount: 320000,
    },
    {
      grantId: "grant-due-later",
      studentName: "지호",
      instrumentName: "피아노",
      paymentStatus: "registered",
      dueOn: null,
      remainingCount: 8,
      validUntil: "2027-01-31",
      amount: 320000,
    },
  ],
  unpaidBookReleases: [
    {
      releaseId: "rel-1",
      studentName: "단율",
      bookTitle: "바이엘 3",
      shippedAt: "2026-11-12",
      amount: 9000,
    },
  ],
  lessonChanges: [
    {
      auditEventId: "audit-1",
      changeType: "rescheduled",
      lessonKind: "academy",
      studentName: "유나",
      teacherIds: ["teacher-kim"],
      previousStartsAt: "2026-11-19T05:00:00.000Z",
      nextStartsAt: "2026-11-19T06:30:00.000Z",
      previousTeacherName: null,
      nextTeacherName: null,
    },
    {
      auditEventId: "audit-2",
      changeType: "rescheduled",
      lessonKind: "private",
      studentName: "도윤",
      teacherIds: ["teacher-lee"],
      previousStartsAt: "2026-11-19T08:00:00.000Z",
      nextStartsAt: "2026-11-19T08:00:00.000Z",
      previousTeacherName: "김선생",
      nextTeacherName: "이선생",
    },
  ],
  consultations: [
    { consultationId: "con-1", name: "새봄", createdAt: "2026-11-18T03:00:00.000Z" },
    { consultationId: "con-old", name: "작년", createdAt: "2026-11-01T03:00:00.000Z" },
  ],
  pendingBookOrders: [{ orderId: "order-1", vendorName: "음악사", orderedOn: "2026-11-15" }],
});

describe("buildDailyTasks", () => {
  it("원장은 수납 → 학부모 연락 → 상담 → 레슨 → 교재 순으로 본다", () => {
    const tasks = buildDailyTasks(source, { role: "owner", today });

    expect(tasks.map((task) => task.category)).toEqual([
      "payment",
      "payment",
      "payment",
      "parent-contact",
      "parent-contact",
      "parent-contact",
      "consultation",
      "lesson",
      "books",
    ]);
  });

  it("미처리 결석은 '보강 날짜 잡기'가 되고 원천이 해소되면 자동으로 빠지는 할 일이다", () => {
    const [task] = buildDailyTasks(source, { role: "owner", today }).filter(
      (item) => item.kind === "makeup",
    );

    expect(task).toMatchObject({
      key: "makeup:att-1",
      title: "유나 바이올린 보강 날짜 잡기",
      detail: "11/18 결석",
      completion: "auto",
      href: "/lessons/academy",
    });
  });

  it("납입일이 지나거나 오늘인 미납만 수납 확인으로 띄우고, 미정 납입일은 띄우지 않는다", () => {
    const keys = buildDailyTasks(source, { role: "owner", today })
      .filter((task) => task.category === "payment")
      .map((task) => task.key);

    expect(keys).toEqual(["tuition:tui-1", "ticket-payment:grant-pay", "book-release:rel-1"]);
  });

  it("금액은 서버가 원장 범위에서만 채워 보내고(데스크는 null), 할 일은 받은 그대로 금액을 붙인다", () => {
    const owner = buildDailyTasks(source, { role: "owner", today }).find(
      (task) => task.key === "tuition:tui-1",
    );
    const deskSource: DailyTaskSource = {
      ...source,
      tuitions: source.tuitions.map((tuition) => ({ ...tuition, amount: null })),
    };
    const desk = buildDailyTasks(deskSource, { role: "desk", today }).find(
      (task) => task.key === "tuition:tui-1",
    );

    expect(owner?.amount).toBe(150000);
    expect(desk).toBeDefined();
    expect(desk?.amount).toBeUndefined();
  });

  it("데스크는 수입 화면 권한이 없어 수강료 할 일에 바로가기를 두지 않는다", () => {
    const desk = buildDailyTasks(source, { role: "desk", today }).find(
      (task) => task.key === "tuition:tui-1",
    );

    expect(desk?.href).toBeUndefined();
  });

  it("잔여가 2회 이하인 회차권은 재등록 안내(수동 완료)로, 잔여 회수가 바뀌면 다시 뜬다", () => {
    const task = buildDailyTasks(source, { role: "owner", today }).find(
      (item) => item.kind === "ticket-renewal",
    );

    expect(task).toMatchObject({
      key: "ticket-renewal:grant-low:1",
      title: "서준 피아노 회차권 재등록 안내",
      detail: "잔여 1회",
      completion: "manual",
      category: "parent-contact",
    });
  });

  it("7일 안에 만료되는 회차권도 재등록 안내에 만료일을 함께 적는다", () => {
    const tasks = buildDailyTasks(
      emptySource({
        lessonTickets: [
          {
            grantId: "grant-expiring",
            studentName: "서준",
            instrumentName: "피아노",
            paymentStatus: "paid",
            dueOn: "2026-10-01",
            remainingCount: 5,
            validUntil: "2026-11-24",
            amount: 320000,
          },
        ],
      }),
      { role: "owner", today },
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.detail).toBe("잔여 5회 · 11/24 만료");
  });

  it("오늘 레슨 변경은 학부모 안내 할 일로, 시간과 선생님 변경을 한국 시간으로 적는다", () => {
    const changes = buildDailyTasks(source, { role: "owner", today }).filter(
      (task) => task.kind === "lesson-change",
    );

    expect(changes.map((task) => [task.title, task.detail])).toEqual([
      ["유나 학부모님께 변경 시간 안내", "14:00 → 15:30"],
      ["도윤 학부모님께 담당 선생님 변경 안내", "김선생 → 이선생"],
    ]);
    expect(changes.every((task) => task.completion === "manual")).toBe(true);
  });

  it("삭제된 오늘 레슨은 취소 안내로 적는다", () => {
    const [task] = buildDailyTasks(
      emptySource({
        lessonChanges: [
          {
            auditEventId: "audit-del",
            changeType: "deleted",
            lessonKind: "academy",
            studentName: "유나",
            teacherIds: ["teacher-kim"],
            previousStartsAt: "2026-11-19T05:00:00.000Z",
            nextStartsAt: null,
            previousTeacherName: null,
            nextTeacherName: null,
          },
        ],
      }),
      { role: "owner", today },
    );

    expect(task).toMatchObject({ title: "유나 학부모님께 레슨 취소 안내", detail: "14:00 레슨 취소" });
  });

  it("상담은 최근 7일 안에 들어온 건만 연락 할 일로 띄운다", () => {
    const keys = buildDailyTasks(source, { role: "owner", today })
      .filter((task) => task.kind === "consultation")
      .map((task) => task.key);

    expect(keys).toEqual(["consultation:con-1"]);
  });

  it("선생님은 담당 학생의 보강·레슨 변경만 보고, 레슨 → 학부모 연락 순으로 본다", () => {
    const tasks = buildDailyTasks(source, {
      role: "teacher",
      today,
      teacherId: "teacher-kim",
    });

    expect(tasks.map((task) => task.key)).toEqual(["makeup:att-1", "lesson-change:audit-1"]);
    expect(tasks.every((task) => task.amount === undefined)).toBe(true);
  });
});

describe("splitDailyTasksByState", () => {
  const tasks = buildDailyTasks(source, { role: "owner", today });

  it("완료한 수동 할 일은 빼고, 답변 대기는 따로 모으며 처리한 사람을 붙인다", () => {
    const result = splitDailyTasksByState(tasks, [
      { taskKey: "lesson-change:audit-1", state: "done", updatedByName: "데스크", updatedAt: "2026-11-19T01:00:00Z" },
      {
        taskKey: "ticket-renewal:grant-low:1",
        state: "waiting_reply",
        updatedByName: "원장",
        updatedAt: "2026-11-19T02:00:00Z",
      },
    ]);

    expect(result.open.map((task) => task.key)).not.toContain("lesson-change:audit-1");
    expect(result.open.map((task) => task.key)).not.toContain("ticket-renewal:grant-low:1");
    expect(result.waitingReply).toEqual([
      expect.objectContaining({
        key: "ticket-renewal:grant-low:1",
        stateUpdatedByName: "원장",
        stateUpdatedAt: "2026-11-19T02:00:00Z",
      }),
    ]);
  });

  it("자동 완료 할 일은 '완료' 상태가 있어도 원천이 남아 있으면 계속 보인다", () => {
    const result = splitDailyTasksByState(tasks, [
      { taskKey: "makeup:att-1", state: "done", updatedByName: "데스크", updatedAt: "2026-11-19T01:00:00Z" },
    ]);

    expect(result.open.map((task) => task.key)).toContain("makeup:att-1");
  });
});
