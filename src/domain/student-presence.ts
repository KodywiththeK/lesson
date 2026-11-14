import type { DailyAcademyAttendanceRow } from "./academy-lesson-attendance";
import { compareKoreanNames } from "./common-list";
import { toFinanceDate } from "./finance-date";
import { comparePrivateLessonStartAt, type PrivateLesson } from "./private-lesson";

/**
 * 등하원 현황: 오늘 오기로 한 학생이 지금 학원에 있는지 표시하는 기록.
 * 일정별 출결(등원 확인·결석)과 별개이고, 학생·날짜당 등원 시각과 하원 시각을 한 번씩만 가진다.
 */
export type PresenceLessonKind = "academy" | "private";

export type StudentPresenceRecord = {
  studentId: string;
  studentName: string;
  /** 그날 이 학생의 수업 종류. 학원레슨과 개인레슨이 모두 있으면 둘 다 들어 있다. */
  lessonKinds: PresenceLessonKind[];
  /** 그날 가장 이른 수업 시작 시각. 목록 정렬에 쓴다. */
  firstStartAt: string | null;
  arrivedAt: string | null;
  leftAt: string | null;
};

export type PresenceState = "expected" | "present" | "left";
export type PresenceAction = "arrive" | "leave" | "cancel-arrive" | "cancel-leave";

export const PRESENCE_STATE_LABELS: Record<PresenceState, string> = {
  expected: "등원 전",
  present: "학원에 있음",
  left: "하원",
};

export const PRESENCE_ACTION_LABELS: Record<PresenceAction, string> = {
  arrive: "등원",
  leave: "하원",
  "cancel-arrive": "등원 취소",
  "cancel-leave": "하원 취소",
};

export const PRESENCE_MESSAGES = {
  arriveFirst: "등원을 먼저 기록해 주세요.",
  cancelLeaveFirst: "하원 기록을 먼저 취소해 주세요.",
  todayOnly: "등하원은 오늘 날짜에만 기록할 수 있습니다.",
} as const;

export function getPresenceState(record: Pick<StudentPresenceRecord, "arrivedAt" | "leftAt">): PresenceState {
  if (!record.arrivedAt) return "expected";

  return record.leftAt ? "left" : "present";
}

export function getPresenceActions(state: PresenceState): PresenceAction[] {
  if (state === "expected") return ["arrive"];
  if (state === "present") return ["leave", "cancel-arrive"];

  return ["cancel-leave"];
}

export function summarizePresence(records: StudentPresenceRecord[]) {
  const summary = { total: records.length, expected: 0, present: 0, left: 0 };

  for (const record of records) {
    summary[getPresenceState(record)] += 1;
  }

  return summary;
}

/** 지금 학원에 있는지를 표시하는 기능이라 오늘 날짜에만 기록한다. */
export function canRecordPresence(date: string, today: string) {
  return date === today;
}

/** 서버 RPC `record_student_presence`와 같은 규칙. 데모·로컬 상태가 같이 쓴다. */
export function applyPresenceAction(
  record: StudentPresenceRecord,
  action: PresenceAction,
  now: string,
): StudentPresenceRecord {
  if (action === "arrive") {
    return { ...record, arrivedAt: record.arrivedAt ?? now };
  }

  if (action === "leave") {
    if (!record.arrivedAt) throw new Error(PRESENCE_MESSAGES.arriveFirst);

    return { ...record, leftAt: record.leftAt ?? now };
  }

  if (action === "cancel-arrive") {
    if (record.leftAt) throw new Error(PRESENCE_MESSAGES.cancelLeaveFirst);

    return { ...record, arrivedAt: null };
  }

  return { ...record, leftAt: null };
}

/** 그날 학원레슨·개인레슨에 오는 학생을 한 줄씩 모은다(취소된 개인레슨 제외). 서버 RPC 목록과 같은 모양이다. */
export function buildPresenceRoster(input: {
  date: string;
  academyRows: DailyAcademyAttendanceRow[];
  privateLessons: PrivateLesson[];
}): StudentPresenceRecord[] {
  const byStudent = new Map<string, StudentPresenceRecord>();

  function add(studentId: string, studentName: string, kind: PresenceLessonKind, startAt: string) {
    const existing = byStudent.get(studentId);

    if (!existing) {
      byStudent.set(studentId, {
        studentId,
        studentName,
        lessonKinds: [kind],
        firstStartAt: startAt,
        arrivedAt: null,
        leftAt: null,
      });
      return;
    }

    byStudent.set(studentId, {
      ...existing,
      lessonKinds: existing.lessonKinds.includes(kind) ? existing.lessonKinds : [...existing.lessonKinds, kind],
      firstStartAt:
        existing.firstStartAt && comparePrivateLessonStartAt(existing.firstStartAt, startAt) <= 0
          ? existing.firstStartAt
          : startAt,
    });
  }

  for (const row of input.academyRows) {
    if (row.date === input.date) {
      add(row.studentId, row.studentName, "academy", `${row.date}T${row.startTime}:00+09:00`);
    }
  }

  for (const lesson of input.privateLessons) {
    if (lesson.status !== "cancelled" && toFinanceDate(lesson.startAt) === input.date) {
      add(lesson.studentId, lesson.studentName, "private", lesson.startAt);
    }
  }

  return [...byStudent.values()].sort(
    (left, right) =>
      comparePrivateLessonStartAt(left.firstStartAt ?? "", right.firstStartAt ?? "") ||
      compareKoreanNames(left.studentName, right.studentName),
  );
}
