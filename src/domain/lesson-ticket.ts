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
