import type { AcademyRole } from "./permissions";
import type { LessonTicketPaymentStatus } from "./lesson-ticket-payment";
import { DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS } from "./lesson-ticket";
import { addDays, formatMonthDay, formatSeoulTime, toFinanceDate } from "./finance-date";
import type { TuitionStatus } from "./tuition-income";

/**
 * '오늘 할 일' 원천 데이터. DB `get_daily_task_source`가 돌려주는 값을 그대로 옮긴 것이다.
 * 금액은 서버가 원장 범위에서만 채우고 다른 역할에게는 null로 보낸다(금액을 거르는 곳은 서버 한 곳).
 * 서버는 넓게만 거르고, 납입일·상담 기간·잔여 회수 같은 업무 기준은 이 모듈이 정한다.
 */
export type DailyTaskSource = {
  /** 결석인데 보강·패스를 정하지 않은 건(오늘까지). */
  unresolvedAbsences: Array<{
    attendanceId: string;
    lessonDate: string;
    studentId: string;
    studentName: string;
    teacherIds: string[];
    instrumentName: string;
  }>;
  /** 입금 전(미입금·미납) 수강료. */
  tuitions: Array<{
    snapshotId: string;
    studentName: string;
    instrumentName: string;
    month: string;
    dueOn: string;
    status: Exclude<TuitionStatus, "paid">;
    amount: number | null;
  }>;
  /** 환불·취소가 아니고 잔여가 남은 회차권. */
  lessonTickets: Array<{
    grantId: string;
    studentName: string;
    instrumentName: string;
    paymentStatus: LessonTicketPaymentStatus;
    dueOn: string | null;
    remainingCount: number;
    validUntil: string;
    amount: number | null;
  }>;
  /** 입금 전에 내준 교재. */
  unpaidBookReleases: Array<{
    releaseId: string;
    studentName: string;
    bookTitle: string;
    shippedAt: string;
    amount: number | null;
  }>;
  /** 오늘(한국 시간) 레슨의 이동·삭제·선생님 변경. */
  lessonChanges: Array<{
    auditEventId: string;
    changeType: "rescheduled" | "deleted";
    lessonKind: "academy" | "private";
    studentName: string;
    /** 이 레슨에 닿는 선생님(이전·새 담당). */
    teacherIds: string[];
    previousStartsAt: string;
    nextStartsAt: string | null;
    previousTeacherName: string | null;
    nextTeacherName: string | null;
  }>;
  consultations: Array<{ consultationId: string; name: string; createdAt: string }>;
  /** 발주했지만 아직 입고되지 않은 교재 주문. */
  pendingBookOrders: Array<{ orderId: string; vendorName: string; orderedOn: string }>;
};

export type DailyTaskCategory = "payment" | "parent-contact" | "consultation" | "lesson" | "books";

export type DailyTaskKind =
  | "makeup"
  | "tuition"
  | "ticket-payment"
  | "ticket-renewal"
  | "book-release"
  | "lesson-change"
  | "consultation"
  | "book-order";

export type DailyTask = {
  /** 상태(완료·답변 대기)를 붙이는 고정 키. `종류:원천 id`. */
  key: string;
  kind: DailyTaskKind;
  category: DailyTaskCategory;
  title: string;
  detail: string;
  /** auto: 원천이 처리되면 저절로 빠진다. manual: 사람이 완료를 눌러야 빠진다. */
  completion: "auto" | "manual";
  amount?: number;
  href?: string;
  /** 이 할 일을 볼 담당 선생님. */
  teacherIds?: string[];
};

export type DailyTaskState = {
  taskKey: string;
  state: "waiting_reply" | "done";
  updatedByName: string | null;
  updatedAt: string;
};

export type DailyTaskWithState = DailyTask & {
  stateUpdatedByName?: string | null;
  stateUpdatedAt?: string;
};

export type BuildDailyTasksOptions = {
  role: AcademyRole;
  today: string;
  /** 선생님이면 본인 teacher id. 담당 학생 건만 남긴다. */
  teacherId?: string;
};

/** 상담 연락 할 일로 띄우는 기간(접수일 포함 7일). */
export const CONSULTATION_TASK_DAYS = 7;
/** 이 기간 안에 만료되는 회차권은 재등록 안내를 띄운다. */
export const TICKET_EXPIRY_NOTICE_DAYS = 7;

const STAFF_CATEGORY_ORDER: DailyTaskCategory[] = ["payment", "parent-contact", "consultation", "lesson", "books"];

const CATEGORY_ORDER: Record<AcademyRole, DailyTaskCategory[]> = {
  owner: STAFF_CATEGORY_ORDER,
  desk: STAFF_CATEGORY_ORDER,
  teacher: ["lesson", "parent-contact"],
};

const TEACHER_VISIBLE_KINDS: DailyTaskKind[] = ["makeup", "lesson-change"];

/** 레슨 종류별 레슨표 주소. 할 일·푸시가 같이 쓴다. */
export function lessonHref(lessonKind: "academy" | "private") {
  return lessonKind === "private" ? "/lessons/private" : "/lessons/academy";
}

/**
 * 원천 데이터에서 역할별 '오늘 할 일'을 만든다.
 * 금액은 원장만, 선생님은 담당 학생의 보강·레슨 변경만 본다. 정렬은 역할별 분류 순서 → 원천 순서다.
 */
export function buildDailyTasks(source: DailyTaskSource, options: BuildDailyTasksOptions): DailyTask[] {
  const tasks = [
    ...buildTuitionTasks(source, options),
    ...buildTicketPaymentTasks(source, options),
    ...buildBookReleaseTasks(source),
    ...buildTicketRenewalTasks(source, options),
    ...buildLessonChangeTasks(source),
    ...buildConsultationTasks(source, options),
    ...buildMakeupTasks(source),
    ...buildBookOrderTasks(source),
  ];
  const categoryOrder = CATEGORY_ORDER[options.role];

  return tasks
    .filter((task) => isVisibleToRole(task, options))
    .sort((left, right) => categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category));
}

/**
 * 공유 상태를 붙여 '할 일'과 '답변 대기'로 나눈다.
 * 완료는 수동 할 일에만 적용한다. 자동 할 일은 원천이 남아 있는 한 계속 보인다.
 */
export function splitDailyTasksByState(tasks: DailyTask[], states: DailyTaskState[]) {
  const stateByKey = new Map(states.map((state) => [state.taskKey, state]));
  const open: DailyTaskWithState[] = [];
  const waitingReply: DailyTaskWithState[] = [];

  for (const task of tasks) {
    const state = stateByKey.get(task.key);

    if (state?.state === "waiting_reply") {
      waitingReply.push({ ...task, stateUpdatedByName: state.updatedByName, stateUpdatedAt: state.updatedAt });
    } else if (state?.state === "done" && task.completion === "manual") {
      continue;
    } else {
      open.push(task);
    }
  }

  return { open, waitingReply };
}

function isVisibleToRole(task: DailyTask, options: BuildDailyTasksOptions) {
  if (options.role !== "teacher") {
    return true;
  }

  return (
    TEACHER_VISIBLE_KINDS.includes(task.kind) &&
    options.teacherId !== undefined &&
    (task.teacherIds ?? []).includes(options.teacherId)
  );
}

function buildTuitionTasks(source: DailyTaskSource, options: BuildDailyTasksOptions): DailyTask[] {
  return source.tuitions
    .filter((tuition) => tuition.status === "overdue" || tuition.dueOn <= options.today)
    .map((tuition) => ({
      key: `tuition:${tuition.snapshotId}`,
      kind: "tuition",
      category: "payment",
      title: `${tuition.studentName} ${tuition.instrumentName} ${Number(tuition.month.slice(5))}월 수강료 입금 확인`,
      detail: describeDueOn(tuition.dueOn, options.today),
      completion: "auto",
      ...amountOf(tuition.amount),
      ...(options.role === "owner" ? { href: "/finance/lesson-income" } : {}),
    }));
}

function buildTicketPaymentTasks(source: DailyTaskSource, options: BuildDailyTasksOptions): DailyTask[] {
  return source.lessonTickets
    .filter(
      (ticket) =>
        (ticket.paymentStatus === "registered" || ticket.paymentStatus === "payment-pending") &&
        ticket.dueOn !== null &&
        ticket.dueOn <= options.today,
    )
    .map((ticket) => ({
      key: `ticket-payment:${ticket.grantId}`,
      kind: "ticket-payment",
      category: "payment",
      title: `${ticket.studentName} ${ticket.instrumentName} 회차권 입금 확인`,
      detail: describeDueOn(ticket.dueOn as string, options.today),
      completion: "auto",
      href: "/passes",
      ...amountOf(ticket.amount),
    }));
}

function buildBookReleaseTasks(source: DailyTaskSource): DailyTask[] {
  return source.unpaidBookReleases.map((release) => ({
    key: `book-release:${release.releaseId}`,
    kind: "book-release",
    category: "payment",
    title: `${release.studentName} 교재 「${release.bookTitle}」 입금 확인`,
    detail: `${formatMonthDay(release.shippedAt)} 출고`,
    completion: "auto",
    href: "/books/shipments",
    ...amountOf(release.amount),
  }));
}

function buildTicketRenewalTasks(source: DailyTaskSource, options: BuildDailyTasksOptions): DailyTask[] {
  const expiryLimit = addDays(options.today, TICKET_EXPIRY_NOTICE_DAYS);

  return source.lessonTickets.flatMap((ticket) => {
    // 잔여 있음·만료 전은 서버가 이미 거른다.
    const lowRemaining = ticket.remainingCount <= DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS.lowRemainingThreshold;
    const expiringSoon = ticket.validUntil <= expiryLimit;

    if (!lowRemaining && !expiringSoon) {
      return [];
    }

    const details = [`잔여 ${ticket.remainingCount}회`];
    if (expiringSoon) {
      details.push(`${formatMonthDay(ticket.validUntil)} 만료`);
    }

    return [
      {
        key: `ticket-renewal:${ticket.grantId}:${ticket.remainingCount}`,
        kind: "ticket-renewal",
        category: "parent-contact",
        title: `${ticket.studentName} ${ticket.instrumentName} 회차권 재등록 안내`,
        detail: details.join(" · "),
        completion: "manual",
        href: "/passes",
      } satisfies DailyTask,
    ];
  });
}

export type LessonChangeFacts = Pick<
  DailyTaskSource["lessonChanges"][number],
  "changeType" | "previousStartsAt" | "nextStartsAt" | "previousTeacherName" | "nextTeacherName"
>;

/** 레슨 변경을 취소·선생님 변경·시간 변경 중 하나로 보고, 한국 시간 기준 설명을 만든다. 할 일과 푸시가 같이 쓴다. */
export function describeLessonChange(change: LessonChangeFacts) {
  const previousTime = formatSeoulTime(change.previousStartsAt);

  if (change.changeType === "deleted" || change.nextStartsAt === null) {
    return { type: "cancelled" as const, detail: `${previousTime} 레슨 취소` };
  }

  if (
    change.previousTeacherName !== null &&
    change.nextTeacherName !== null &&
    change.previousTeacherName !== change.nextTeacherName
  ) {
    return { type: "teacher" as const, detail: `${change.previousTeacherName} → ${change.nextTeacherName}` };
  }

  return { type: "time" as const, detail: `${previousTime} → ${formatSeoulTime(change.nextStartsAt)}` };
}

const LESSON_CHANGE_NOTICE_TITLES = {
  cancelled: "레슨 취소 안내",
  teacher: "담당 선생님 변경 안내",
  time: "변경 시간 안내",
} as const;

function buildLessonChangeTasks(source: DailyTaskSource): DailyTask[] {
  return source.lessonChanges.map((change) => {
    const { type, detail } = describeLessonChange(change);

    return {
      key: `lesson-change:${change.auditEventId}`,
      kind: "lesson-change",
      category: "parent-contact",
      title: `${change.studentName} 학부모님께 ${LESSON_CHANGE_NOTICE_TITLES[type]}`,
      detail,
      completion: "manual",
      href: lessonHref(change.lessonKind),
      teacherIds: change.teacherIds,
    };
  });
}

function buildConsultationTasks(source: DailyTaskSource, options: BuildDailyTasksOptions): DailyTask[] {
  const since = addDays(options.today, -(CONSULTATION_TASK_DAYS - 1));

  return source.consultations
    .filter((consultation) => toFinanceDate(consultation.createdAt) >= since)
    .map((consultation) => ({
      key: `consultation:${consultation.consultationId}`,
      kind: "consultation",
      category: "consultation",
      title: `${consultation.name} 상담 연락`,
      detail: `${formatMonthDay(toFinanceDate(consultation.createdAt))} 접수`,
      completion: "manual",
      href: "/management/consultations",
    }));
}

function buildMakeupTasks(source: DailyTaskSource): DailyTask[] {
  return source.unresolvedAbsences.map((absence) => ({
    key: `makeup:${absence.attendanceId}`,
    kind: "makeup",
    category: "lesson",
    title: `${absence.studentName} ${absence.instrumentName} 보강 날짜 잡기`,
    detail: `${formatMonthDay(absence.lessonDate)} 결석`,
    completion: "auto",
    href: lessonHref("academy"),
    teacherIds: absence.teacherIds,
  }));
}

function buildBookOrderTasks(source: DailyTaskSource): DailyTask[] {
  return source.pendingBookOrders.map((order) => ({
    key: `book-order:${order.orderId}`,
    kind: "book-order",
    category: "books",
    title: `${order.vendorName} 교재 입고 확인`,
    detail: `${formatMonthDay(order.orderedOn)} 발주`,
    completion: "auto",
    href: "/books/orders",
  }));
}

function amountOf(amount: number | null) {
  return amount === null ? {} : { amount };
}

function describeDueOn(dueOn: string, today: string) {
  return dueOn === today ? "오늘 납입일" : `납입일 ${formatMonthDay(dueOn)} 지남`;
}
