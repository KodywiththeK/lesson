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

export type LessonTicketManualAdjustmentInput = {
  academyId: string;
  deltaCount: number;
  reason: string;
  adjustedAt: string;
  adjustedBy: string;
};

export type LessonTicketManualAdjustmentOptions = {
  canAdjust: boolean;
};

export type LessonTicketManualAdjustmentEvent = {
  type: "manual-adjustment";
  academyId: string;
  studentId: string;
  instrumentId: string;
  previousRemainingCount: number;
  nextRemainingCount: number;
  deltaCount: number;
  reason: string;
  adjustedAt: string;
  adjustedBy: string;
};

export type LessonTicketManualAdjustmentResult = {
  ticket: LessonTicketBalance;
  event: LessonTicketManualAdjustmentEvent;
};

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
  validFrom: string;
  validUntil: string;
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

export type LessonTicketStatus =
  | "low-remaining"
  | "expiring-soon"
  | "expired"
  | "exhausted";

export type LessonTicketStatusOptions = {
  today: string;
  lowRemainingThreshold: number;
  expiringWithinDays: number;
};

export type LessonTicketStatusSummary = {
  statuses: LessonTicketStatus[];
  daysUntilExpiration: number;
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

/** 잔여 2회 이하는 잔여 부족, 만료 7일 전부터는 만료 임박으로 표시한다. */
export const DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS = {
  lowRemainingThreshold: 2,
  expiringWithinDays: 7,
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
      (ticket) => ticket.validFrom,
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
    "expiring-soon": "만료 임박",
    expired: "만료",
    exhausted: "소진",
  };

  return labels[status];
}

export function registerLessonTicket(
  existingTicket: LessonTicket | undefined,
  registration: LessonTicketRegistration,
): RegisterLessonTicketResult {
  assertPositiveCount(registration.grantedCount);
  assertValidDateRange(registration.validFrom, registration.validUntil);

  if (!existingTicket) {
    return {
      ticket: {
        academyId: registration.academyId,
        studentId: registration.studentId,
        instrumentId: registration.instrumentId,
        totalGrantedCount: registration.grantedCount,
        remainingCount: registration.grantedCount,
        validFrom: registration.validFrom,
        validUntil: registration.validUntil,
        registeredAt: registration.registeredAt,
      },
      event: {
        type: "created-new-ticket",
        addedCount: registration.grantedCount,
        nextValidUntil: registration.validUntil,
      },
    };
  }

  assertSameTicketScope(existingTicket, registration);

  return {
    ticket: {
      ...existingTicket,
      totalGrantedCount:
        existingTicket.totalGrantedCount + registration.grantedCount,
      remainingCount: existingTicket.remainingCount + registration.grantedCount,
      validFrom: registration.validFrom,
      validUntil: registration.validUntil,
      registeredAt: registration.registeredAt,
    },
    event: {
      type: "merged-existing-ticket",
      addedCount: registration.grantedCount,
      previousValidUntil: existingTicket.validUntil,
      nextValidUntil: registration.validUntil,
    },
  };
}

export function summarizeLessonTicketStatus(
  ticket: LessonTicket,
  options: LessonTicketStatusOptions,
): LessonTicketStatusSummary {
  const statuses: LessonTicketStatus[] = [];
  const daysUntilExpiration =
    toUtcDayNumber(ticket.validUntil) - toUtcDayNumber(options.today);

  if (ticket.remainingCount <= 0) {
    statuses.push("exhausted");
  } else if (ticket.remainingCount <= options.lowRemainingThreshold) {
    statuses.push("low-remaining");
  }

  if (daysUntilExpiration < 0) {
    statuses.push("expired");
  } else if (daysUntilExpiration <= options.expiringWithinDays) {
    statuses.push("expiring-soon");
  }

  return {
    statuses,
    daysUntilExpiration,
  };
}

export function adjustLessonTicketManually(
  ticket: LessonTicketBalance,
  input: LessonTicketManualAdjustmentInput,
  options: LessonTicketManualAdjustmentOptions,
): LessonTicketManualAdjustmentResult {
  if (!options.canAdjust) {
    throw new Error("회차권 수동 수정 권한이 없습니다.");
  }

  if (ticket.academyId !== input.academyId) {
    throw new Error("학원 범위가 일치하지 않습니다.");
  }

  assertNonZeroInteger(input.deltaCount);

  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("회차권 수동 수정 사유는 필수입니다.");
  }

  const nextRemainingCount = ticket.remainingCount + input.deltaCount;

  if (nextRemainingCount < 0) {
    throw new Error("잔여 회차는 0보다 작을 수 없습니다.");
  }

  return {
    ticket: {
      ...ticket,
      remainingCount: nextRemainingCount,
    },
    event: {
      type: "manual-adjustment",
      academyId: ticket.academyId,
      studentId: ticket.studentId,
      instrumentId: ticket.instrumentId,
      previousRemainingCount: ticket.remainingCount,
      nextRemainingCount,
      deltaCount: input.deltaCount,
      reason,
      adjustedAt: input.adjustedAt,
      adjustedBy: input.adjustedBy,
    },
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

function assertNonZeroInteger(count: number) {
  if (!Number.isInteger(count) || count === 0) {
    throw new Error("회차권 수동 수정 회수는 0이 아닌 정수여야 합니다.");
  }
}

function assertValidDateRange(validFrom: string, validUntil: string) {
  if (toUtcDayNumber(validUntil) < toUtcDayNumber(validFrom)) {
    throw new Error("회차권 유효 만료일은 시작일 이후여야 합니다.");
  }
}

function toUtcDayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
