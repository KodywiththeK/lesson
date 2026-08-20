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

export function registerLessonTicket(
  existingTicket: LessonTicket | undefined,
  registration: LessonTicketRegistration,
): RegisterLessonTicketResult {
  assertPositiveCount(registration.grantedCount);

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

function toUtcDayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
