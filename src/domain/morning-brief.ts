import { getClosuresOnDate, type AcademyClosure } from "./academy-closure";
import {
  buildDailyTasks,
  splitDailyTasksByState,
  type DailyTaskCategory,
  type DailyTaskSource,
  type DailyTaskState,
} from "./daily-tasks";
import { formatKoreanDateLabel, formatSeoulTime } from "./finance-date";
import { formatWon } from "./money-input";
import type { AcademyRole } from "./permissions";

/** 아침 브리핑 전용 원천. DB `get_morning_brief_source_for_service`가 돌려준다. */
export type MorningBriefSource = {
  academyName: string;
  /** 오늘(한국 시간) 예정된 레슨. */
  lessons: Array<{
    startsAt: string;
    studentName: string;
    instrumentName: string;
    teacherId: string | null;
    teacherName: string | null;
    lessonKind: "academy" | "private";
    origin: string | null;
  }>;
  closures: AcademyClosure[];
  /** 최근 30일 안의 읽지 않은 레슨 메모 수. */
  unreadMemoCount: number;
};

export type MorningBriefInput = {
  briefSource: MorningBriefSource;
  taskSource: DailyTaskSource;
  taskStates: DailyTaskState[];
  role: AcademyRole;
  today: string;
  teacherId?: string;
};

export type MorningBrief = {
  subject: string;
  dateLabel: string;
  summary: Array<{ label: string; value: number }>;
  closures: string[];
  schedule: Array<{
    teacherName: string;
    lessons: Array<{ time: string; studentName: string; instrumentName: string; tag: "보강" | "개인" | null }>;
  }>;
  taskSections: Array<{
    title: string;
    items: Array<{ title: string; detail: string; href?: string }>;
  }>;
  memoNotice: string | null;
};

const CATEGORY_TITLES: Record<DailyTaskCategory, string> = {
  payment: "수납 확인",
  "parent-contact": "학부모 연락",
  consultation: "상담",
  lesson: "보강·레슨",
  books: "교재",
};

const UNASSIGNED_TEACHER = "담당 미정";

/**
 * 역할별 아침 브리핑 메일 내용. 할 일은 대시보드와 같은 `buildDailyTasks`·공유 상태를 그대로 쓴다.
 * 데스크는 금액 없이, 완료한 일은 빼고, 답변 대기는 숫자로만 센다.
 */
export function buildMorningBrief(input: MorningBriefInput): MorningBrief {
  const { open, waitingReply } = splitTasks(input);
  const lessons = visibleLessons(input);
  const dateLabel = formatKoreanDateLabel(input.today);

  return {
    subject: `[${input.briefSource.academyName}] ${dateLabel} 레슨 ${lessons.length}건 · 할 일 ${open.length}건`,
    dateLabel,
    summary: [
      { label: "오늘 레슨", value: lessons.length },
      { label: "보강", value: lessons.filter((lesson) => lesson.origin === "makeup").length },
      { label: "할 일", value: open.length },
      { label: "답변 대기", value: waitingReply.length },
    ],
    closures: getClosuresOnDate(input.briefSource.closures, input.today).map((closure) => closure.title),
    schedule: groupScheduleByTeacher(lessons),
    taskSections: groupTasksByCategory(open),
    memoNotice:
      input.briefSource.unreadMemoCount > 0
        ? `읽지 않은 레슨 메모 ${input.briefSource.unreadMemoCount}건이 있습니다.`
        : null,
  };
}

/** 아침 브리핑 한 줄 푸시. 선생님은 본인 레슨 수만 본다. */
export function buildMorningBriefPush(input: MorningBriefInput) {
  const { open } = splitTasks(input);
  const lessonCount = visibleLessons(input).length;
  const lessonLabel = input.role === "teacher" ? "오늘 내 레슨" : "오늘 레슨";

  return {
    title: "오늘 브리핑",
    body: `${lessonLabel} ${lessonCount}건 · 할 일 ${open.length}건`,
    url: "/",
    tag: `morning-brief:${input.today}`,
    // 설치한 앱 아이콘 배지를 오늘 할 일 수로 맞춘다(서비스 워커가 처리).
    badgeCount: open.length,
  };
}

function splitTasks(input: MorningBriefInput) {
  const tasks = buildDailyTasks(input.taskSource, {
    role: input.role,
    today: input.today,
    teacherId: input.teacherId,
  });

  return splitDailyTasksByState(tasks, input.taskStates);
}

function visibleLessons(input: MorningBriefInput) {
  return input.role === "teacher"
    ? input.briefSource.lessons.filter((lesson) => lesson.teacherId !== null && lesson.teacherId === input.teacherId)
    : input.briefSource.lessons;
}

function groupScheduleByTeacher(lessons: MorningBriefSource["lessons"]): MorningBrief["schedule"] {
  const groups = new Map<string, MorningBrief["schedule"][number]["lessons"]>();
  const sorted = [...lessons].sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  for (const lesson of sorted) {
    const teacherName = lesson.teacherName ?? UNASSIGNED_TEACHER;
    const group = groups.get(teacherName) ?? [];
    group.push({
      time: formatSeoulTime(lesson.startsAt),
      studentName: lesson.studentName,
      instrumentName: lesson.instrumentName,
      tag: lesson.origin === "makeup" ? "보강" : lesson.lessonKind === "private" ? "개인" : null,
    });
    groups.set(teacherName, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === UNASSIGNED_TEACHER || right === UNASSIGNED_TEACHER) {
        return left === UNASSIGNED_TEACHER ? 1 : -1;
      }
      return left.localeCompare(right, "ko");
    })
    .map(([teacherName, groupLessons]) => ({ teacherName, lessons: groupLessons }));
}

function groupTasksByCategory(tasks: ReturnType<typeof splitTasks>["open"]): MorningBrief["taskSections"] {
  const sections = new Map<DailyTaskCategory, MorningBrief["taskSections"][number]>();

  for (const task of tasks) {
    const section = sections.get(task.category) ?? { title: CATEGORY_TITLES[task.category], items: [] };
    section.items.push({
      title: task.title,
      detail: task.amount === undefined ? task.detail : `${task.detail} · ${formatWon(task.amount)}`,
      ...(task.href ? { href: task.href } : {}),
    });
    sections.set(task.category, section);
  }

  return [...sections.values()];
}
