import {
  buildListView,
  type ListView,
  type PageSizeOption,
} from "./common-list";

export type AttendanceStatus =
  | "scheduled"
  | "present"
  | "absent"
  | "cancelled"
  | "makeup"
  | "pass";

export type LessonTicketBalance = {
  academyId: string;
  studentId: string;
  instrumentId: string;
  remainingCount: number;
};

/** DB `register_lesson_ticket`의 상한과 같다. */
export const MAX_LESSON_TICKET_VALID_DAYS = 3650;

export type LessonTicket = LessonTicketBalance & {
  totalGrantedCount: number;
  validFrom: string;
  validUntil: string;
  registeredAt: string;
};

export type LessonTicketListItem = LessonTicket & {
  ticketId: string;
  studentName: string;
  instrumentName: string;
  serviceTotalCount?: number;
  serviceRemainingCount?: number;
  paidAmount?: number;
  paidAt?: string;
};

export type AttendanceConfirmation = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  instrumentId: string;
  status: AttendanceStatus;
};

export type LessonTicketUsage = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  instrumentId: string;
  usedCount: 1;
};

export type LessonTicketAdjustmentInput = {
  totalGrantedCount: number;
  remainingCount: number;
  validUntil: string;
  reason: string;
};

export type LessonTicketAdjustmentValidation =
  | { ok: true }
  | { ok: false; reason: string };

export type ApplyAttendanceOptions = {
  alreadyDeductedLessonEventIds?: string[];
};

export type ApplyAttendanceResult = {
  ticket: LessonTicketBalance;
  usage?: LessonTicketUsage;
  skippedReason?: "not-present" | "already-deducted";
};

export type LessonTicketRegistration = {
  academyId: string;
  studentId: string;
  instrumentId: string;
  grantedCount: number;
  /** 사용 기한(일수). 만료일은 등록일에 이 일수를 더해 계산한다. */
  validDays: number;
  registeredAt: string;
};

export type LessonTicketRegistrationEvent =
  | {
      type: "created-new-ticket";
      addedCount: number;
      nextValidUntil: string;
    }
  | {
      type: "merged-existing-ticket";
      addedCount: number;
      previousValidUntil: string;
      nextValidUntil: string;
    };

export type RegisterLessonTicketResult = {
  ticket: LessonTicket;
  event: LessonTicketRegistrationEvent;
};

export type LessonTicketStatus = "low-remaining" | "expired" | "exhausted";

export type LessonTicketStatusOptions = {
  today: string;
  lowRemainingThreshold: number;
};

export type LessonTicketStatusSummary = {
  statuses: LessonTicketStatus[];
};

export type LessonTicketListFilters = {
  status?: LessonTicketStatus;
};

export type BuildLessonTicketListOptions = LessonTicketStatusOptions & {
  academyId: string;
  search?: string;
  filters?: LessonTicketListFilters;
  page?: number;
  pageSize?: PageSizeOption;
};

export type LessonTicketListRow = LessonTicketListItem &
  LessonTicketStatusSummary;

/** 잔여 2회 이하는 잔여 부족으로 표시한다. 만료일이 다가오는 것은 따로 강조하지 않는다. */
export const DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS = {
  lowRemainingThreshold: 2,
} as const;

export function applyAttendanceToTicket(
  ticket: LessonTicketBalance,
  attendance: AttendanceConfirmation,
  options: ApplyAttendanceOptions = {},
): ApplyAttendanceResult {
  assertSameScope(ticket, attendance);

  if (attendance.status !== "present") {
    return {
      ticket,
      skippedReason: "not-present",
    };
  }

  if (
    options.alreadyDeductedLessonEventIds?.includes(attendance.lessonEventId)
  ) {
    return {
      ticket,
      skippedReason: "already-deducted",
    };
  }

  if (ticket.remainingCount <= 0) {
    throw new Error("차감 가능한 회차가 없습니다.");
  }

  return {
    ticket: {
      ...ticket,
      remainingCount: ticket.remainingCount - 1,
    },
    usage: {
      academyId: attendance.academyId,
      lessonEventId: attendance.lessonEventId,
      studentId: attendance.studentId,
      instrumentId: attendance.instrumentId,
      usedCount: 1,
    },
  };
}

export function buildLessonTicketList(
  tickets: LessonTicketListItem[],
  options: BuildLessonTicketListOptions,
): ListView<LessonTicketListRow> {
  const rows = tickets
    .filter((ticket) => ticket.academyId === options.academyId)
    .map((ticket) => ({
      ...ticket,
      ...summarizeLessonTicketStatus(ticket, options),
    }))
    .filter((ticket) => matchesLessonTicketFilters(ticket, options.filters));

  return buildListView(rows, {
    getName: (ticket) => ticket.studentName,
    getTieBreaker: toLessonTicketTieBreaker,
    search: options.search,
    searchFields: [
      (ticket) => ticket.studentName,
      (ticket) => ticket.instrumentName,
      (ticket) => ticket.registeredAt,
      (ticket) => ticket.validUntil,
      (ticket) => ticket.statuses.map(formatLessonTicketStatus).join(" "),
    ],
    page: options.page,
    pageSize: options.pageSize,
  });
}

export function formatLessonTicketStatus(status: LessonTicketStatus) {
  const labels: Record<LessonTicketStatus, string> = {
    "low-remaining": "잔여 부족",
    expired: "만료",
    exhausted: "소진",
  };

  return labels[status];
}

/** 만료일 = 등록일 + 사용 기한(일수). */
export function calculateLessonTicketValidUntil(
  registeredAt: string,
  validDays: number,
) {
  assertPositiveValidDays(validDays);

  return toDateString(toUtcDayNumber(registeredAt) + validDays);
}

/** 같은 원생·악기 회차권이 있으면 회수를 더하고 만료일을 등록일 기준으로 새로 계산한다. */
export function applyLessonTicketRegistration(
  existingTicket: LessonTicket | undefined,
  registration: LessonTicketRegistration,
): RegisterLessonTicketResult {
  assertPositiveCount(registration.grantedCount);
  const validUntil = calculateLessonTicketValidUntil(
    registration.registeredAt,
    registration.validDays,
  );

  if (!existingTicket) {
    return {
      ticket: {
        academyId: registration.academyId,
        studentId: registration.studentId,
        instrumentId: registration.instrumentId,
        totalGrantedCount: registration.grantedCount,
        remainingCount: registration.grantedCount,
        validFrom: registration.registeredAt,
        validUntil,
        registeredAt: registration.registeredAt,
      },
      event: {
        type: "created-new-ticket",
        addedCount: registration.grantedCount,
        nextValidUntil: validUntil,
      },
    };
  }

  assertSameTicketScope(existingTicket, registration);
  if (toUtcDayNumber(registration.registeredAt) < toUtcDayNumber(existingTicket.registeredAt)) {
    throw new Error("등록일은 직전 등록일보다 앞설 수 없습니다.");
  }

  return {
    ticket: {
      ...existingTicket,
      totalGrantedCount:
        existingTicket.totalGrantedCount + registration.grantedCount,
      remainingCount: existingTicket.remainingCount + registration.grantedCount,
      validFrom: existingTicket.validFrom,
      validUntil,
      registeredAt: registration.registeredAt,
    },
    event: {
      type: "merged-existing-ticket",
      addedCount: registration.grantedCount,
      previousValidUntil: existingTicket.validUntil,
      nextValidUntil: validUntil,
    },
  };
}

export function summarizeLessonTicketStatus(
  ticket: LessonTicket,
  options: LessonTicketStatusOptions,
): LessonTicketStatusSummary {
  const statuses: LessonTicketStatus[] = [];

  if (ticket.remainingCount <= 0) {
    statuses.push("exhausted");
  } else if (ticket.remainingCount <= options.lowRemainingThreshold) {
    statuses.push("low-remaining");
  }

  if (toUtcDayNumber(ticket.validUntil) < toUtcDayNumber(options.today)) {
    statuses.push("expired");
  }

  return { statuses };
}

export function describeLessonTicketRemainingDays(validUntil: string, today: string) {
  const remainingDays = toUtcDayNumber(validUntil) - toUtcDayNumber(today);
  if (remainingDays < 0) return `${Math.abs(remainingDays)}일 지남`;
  if (remainingDays === 0) return "0일 남음 · 오늘까지 사용 가능";
  return `${remainingDays}일 남음`;
}

export function validateLessonTicketAdjustment(
  ticket: LessonTicket,
  input: LessonTicketAdjustmentInput,
): LessonTicketAdjustmentValidation {
  if (!Number.isInteger(input.totalGrantedCount) || input.totalGrantedCount < 1) {
    return invalidAdjustment("부여 회수는 1회 이상의 정수여야 합니다.");
  }

  if (!Number.isInteger(input.remainingCount) || input.remainingCount < 0) {
    return invalidAdjustment("잔여 회수는 0회 이상의 정수여야 합니다.");
  }

  if (input.remainingCount > input.totalGrantedCount) {
    return invalidAdjustment("잔여 회수는 부여 회수보다 많을 수 없습니다.");
  }

  if (!input.validUntil) {
    return invalidAdjustment("만료일을 입력해 주세요.");
  }

  if (toUtcDayNumber(input.validUntil) < toUtcDayNumber(ticket.registeredAt)) {
    return invalidAdjustment("만료일은 마지막 등록일 이후여야 합니다.");
  }

  if (!input.reason.trim()) {
    return invalidAdjustment("수정 사유를 입력해 주세요.");
  }

  return { ok: true };
}

/** 잘못 입력된 회수·만료일을 직접 고친다. 입력이 올바르지 않으면 이유와 함께 던진다. */
export function adjustLessonTicket(
  ticket: LessonTicket,
  input: LessonTicketAdjustmentInput,
): LessonTicket {
  const validation = validateLessonTicketAdjustment(ticket, input);

  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  return {
    ...ticket,
    totalGrantedCount: input.totalGrantedCount,
    remainingCount: input.remainingCount,
    validUntil: input.validUntil,
  };
}

function matchesLessonTicketFilters(
  ticket: LessonTicketListRow,
  filters: LessonTicketListFilters | undefined,
) {
  return !filters?.status || ticket.statuses.includes(filters.status);
}

/** 원생명이 같으면 악기명 → 만료일 → 회차권 id 순. 탭 구분자는 글자보다 앞서 정렬되어 항목별 순서를 유지한다. */
function toLessonTicketTieBreaker(ticket: LessonTicketListRow) {
  return [ticket.instrumentName, ticket.validUntil, ticket.ticketId].join("\t");
}

function assertSameScope(
  ticket: LessonTicketBalance,
  attendance: AttendanceConfirmation,
) {
  if (ticket.academyId !== attendance.academyId) {
    throw new Error("학원 범위가 일치하지 않습니다.");
  }

  if (ticket.studentId !== attendance.studentId) {
    throw new Error("원생 범위가 일치하지 않습니다.");
  }

  if (ticket.instrumentId !== attendance.instrumentId) {
    throw new Error("악기 범위가 일치하지 않습니다.");
  }
}

function assertSameTicketScope(
  ticket: LessonTicket,
  registration: LessonTicketRegistration,
) {
  if (ticket.academyId !== registration.academyId) {
    throw new Error("학원 범위가 일치하지 않습니다.");
  }

  if (ticket.studentId !== registration.studentId) {
    throw new Error("원생 범위가 일치하지 않습니다.");
  }

  if (ticket.instrumentId !== registration.instrumentId) {
    throw new Error("악기 범위가 일치하지 않습니다.");
  }
}

function assertPositiveCount(count: number) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("회차권 부여 회수는 1 이상의 정수여야 합니다.");
  }
}

function assertPositiveValidDays(validDays: number) {
  if (!Number.isInteger(validDays) || validDays <= 0) {
    throw new Error("사용 기한은 1일 이상의 정수여야 합니다.");
  }

  if (validDays > MAX_LESSON_TICKET_VALID_DAYS) {
    throw new Error(`사용 기한은 ${MAX_LESSON_TICKET_VALID_DAYS}일 이하로 입력해 주세요.`);
  }
}

function invalidAdjustment(reason: string): LessonTicketAdjustmentValidation {
  return { ok: false, reason };
}

function toDateString(utcDayNumber: number) {
  return new Date(utcDayNumber * 86_400_000).toISOString().slice(0, 10);
}

function toUtcDayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
