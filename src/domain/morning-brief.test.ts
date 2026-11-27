import { describe, expect, it } from "vitest";

import type { DailyTaskSource } from "./daily-tasks";
import { buildMorningBrief, buildMorningBriefPush, type MorningBriefSource } from "./morning-brief";

const today = "2026-11-19";

const briefSource: MorningBriefSource = {
  academyName: "더 클래식",
  lessons: [
    {
      startsAt: "2026-11-19T06:00:00.000Z",
      studentName: "유나",
      instrumentName: "바이올린",
      teacherId: "teacher-kim",
      teacherName: "김선생",
      lessonKind: "academy",
      origin: "makeup",
    },
    {
      startsAt: "2026-11-19T05:00:00.000Z",
      studentName: "단율",
      instrumentName: "피아노",
      teacherId: "teacher-kim",
      teacherName: "김선생",
      lessonKind: "academy",
      origin: "regular",
    },
    {
      startsAt: "2026-11-19T08:00:00.000Z",
      studentName: "도윤",
      instrumentName: "첼로",
      teacherId: "teacher-lee",
      teacherName: "이선생",
      lessonKind: "private",
      origin: "regular",
    },
    {
      startsAt: "2026-11-19T09:00:00.000Z",
      studentName: "하린",
      instrumentName: "피아노",
      teacherId: null,
      teacherName: null,
      lessonKind: "academy",
      origin: "regular",
    },
  ],
  closures: [
    { id: "c1", title: "정기 휴원", startsOn: "2026-11-01", endsOn: "2026-11-30", weekday: 4, active: true },
    { id: "c2", title: "월요 휴원", startsOn: "2026-11-01", endsOn: "2026-11-30", weekday: 1, active: true },
  ],
  unreadMemoCount: 1,
};

const taskSource: DailyTaskSource = {
  unresolvedAbsences: [],
  tuitions: [
    {
      snapshotId: "tui-1",
      studentName: "단율",
      instrumentName: "피아노",
      month: "2026-11",
      dueOn: "2026-11-10",
      status: "unpaid",
      amount: 150000,
      contact: null,
    },
  ],
  lessonTickets: [],
  unpaidBookReleases: [],
  lessonChanges: [
    {
      auditEventId: "audit-1",
      changeType: "deleted",
      lessonKind: "academy",
      studentName: "서준",
      teacherIds: ["teacher-kim"],
      previousStartsAt: "2026-11-19T07:00:00.000Z",
      nextStartsAt: null,
      previousTeacherName: null,
      nextTeacherName: null,
      contact: null,
    },
  ],
  consultations: [{ consultationId: "con-1", name: "새봄", createdAt: "2026-11-18T03:00:00.000Z", phone: null, instrumentNames: [] }],
  pendingBookOrders: [],
};

describe("buildMorningBrief", () => {
  it("제목에 날짜와 레슨·할 일 수를 담고, 요약 숫자는 레슨·보강·할 일·답변 대기 순이다", () => {
    const brief = buildMorningBrief({ briefSource, taskSource, taskStates: [], role: "owner", today });

    expect(brief.subject).toBe("[더 클래식] 11월 19일(목) 레슨 4건 · 할 일 3건");
    expect(brief.summary).toEqual([
      { label: "오늘 레슨", value: 4 },
      { label: "보강", value: 1 },
      { label: "할 일", value: 3 },
      { label: "답변 대기", value: 0 },
    ]);
  });

  it("오늘 해당하는 휴원만 적는다", () => {
    const brief = buildMorningBrief({ briefSource, taskSource, taskStates: [], role: "owner", today });

    expect(brief.closures).toEqual(["정기 휴원"]);
  });

  it("시간표는 선생님별로 묶고 시간순으로, 보강·개인레슨은 표시를 붙인다(미배정은 마지막)", () => {
    const brief = buildMorningBrief({ briefSource, taskSource, taskStates: [], role: "owner", today });

    expect(brief.schedule).toEqual([
      {
        teacherName: "김선생",
        lessons: [
          { time: "14:00", studentName: "단율", instrumentName: "피아노", tag: null },
          { time: "15:00", studentName: "유나", instrumentName: "바이올린", tag: "보강" },
        ],
      },
      {
        teacherName: "이선생",
        lessons: [{ time: "17:00", studentName: "도윤", instrumentName: "첼로", tag: "개인" }],
      },
      {
        teacherName: "담당 미정",
        lessons: [{ time: "18:00", studentName: "하린", instrumentName: "피아노", tag: null }],
      },
    ]);
  });

  it("할 일은 역할 순서대로 구획을 나누고, 원장은 금액을, 데스크는 금액 없이 본다", () => {
    const owner = buildMorningBrief({ briefSource, taskSource, taskStates: [], role: "owner", today });
    // 데스크용 원천은 서버가 금액을 비워 보낸다.
    const deskTaskSource: DailyTaskSource = {
      ...taskSource,
      tuitions: taskSource.tuitions.map((tuition) => ({ ...tuition, amount: null })),
    };
    const desk = buildMorningBrief({ briefSource, taskSource: deskTaskSource, taskStates: [], role: "desk", today });

    expect(owner.taskSections.map((section) => section.title)).toEqual(["수납 확인", "학부모 연락", "상담"]);
    expect(owner.taskSections[0]?.items[0]).toEqual({
      title: "단율 피아노 11월 수강료 입금 확인",
      detail: "납입일 11/10 지남 · 150,000원",
      href: "/finance/lesson-income",
    });
    expect(desk.taskSections[0]?.items[0]).toEqual({
      title: "단율 피아노 11월 수강료 입금 확인",
      detail: "납입일 11/10 지남",
    });
  });

  it("완료한 일은 빼고 답변 대기는 숫자로만 센다", () => {
    const brief = buildMorningBrief({
      briefSource,
      taskSource,
      taskStates: [
        { taskKey: "consultation:con-1", state: "done", updatedByName: "데스크", updatedAt: "2026-11-18T09:00:00Z" },
        { taskKey: "lesson-change:audit-1", state: "waiting_reply", updatedByName: "원장", updatedAt: "2026-11-18T09:00:00Z" },
      ],
      role: "owner",
      today,
    });

    expect(brief.taskSections.map((section) => section.title)).toEqual(["수납 확인"]);
    expect(brief.summary.find((item) => item.label === "답변 대기")?.value).toBe(1);
  });

  it("읽지 않은 메모가 있으면 안내한다", () => {
    expect(buildMorningBrief({ briefSource, taskSource, taskStates: [], role: "owner", today }).memoNotice).toBe(
      "읽지 않은 레슨 메모 1건이 있습니다.",
    );
    expect(
      buildMorningBrief({
        briefSource: { ...briefSource, unreadMemoCount: 0 },
        taskSource,
        taskStates: [],
        role: "owner",
        today,
      }).memoNotice,
    ).toBeNull();
  });
});

describe("buildMorningBriefPush", () => {
  it("원장·데스크는 오늘 레슨과 할 일 수, 선생님은 오늘 내 레슨 수를 받는다", () => {
    expect(
      buildMorningBriefPush({ briefSource, taskSource, taskStates: [], role: "owner", today }),
    ).toEqual({ title: "오늘 브리핑", body: "오늘 레슨 4건 · 할 일 3건", url: "/", tag: "morning-brief:2026-11-19" });
    expect(
      buildMorningBriefPush({ briefSource, taskSource, taskStates: [], role: "teacher", today, teacherId: "teacher-kim" }),
    ).toEqual({ title: "오늘 브리핑", body: "오늘 내 레슨 2건 · 할 일 1건", url: "/", tag: "morning-brief:2026-11-19" });
  });
});
