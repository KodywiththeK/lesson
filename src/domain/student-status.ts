export type StudentStatus = "enrolled" | "suspended" | "withdrawn";

export type StudentStatusRecord = {
  academyId: string;
  studentId: string;
  studentName: string;
  status: StudentStatus;
  suspendedAt?: string;
  withdrawnAt?: string;
};

export type StudentStatusAction = "suspend" | "withdraw" | "reinstate";

export type StudentStatusTransition = {
  action: StudentStatusAction;
  reason: string;
  changedAt: string;
};

export type StudentStatusTransitionEvent = {
  type: "suspended" | "withdrawn" | "reinstated";
  reason: string;
  changedAt: string;
  confirmationRequired: true;
};

export type StudentStatusTransitionResult = {
  student: StudentStatusRecord;
  event: StudentStatusTransitionEvent;
};

export type WithdrawnStudentRetentionOptions = {
  today: string;
  retentionDays: number;
};

export type WithdrawnStudentRetention = {
  deletableOn: string;
  daysRemaining: number;
  canDelete: boolean;
};

export function transitionStudentStatus(
  student: StudentStatusRecord,
  transition: StudentStatusTransition,
): StudentStatusTransitionResult {
  if (student.status === "withdrawn" && transition.action === "suspend") {
    throw new Error("퇴원 원생은 먼저 재원 처리해야 합니다.");
  }

  if (transition.action === "suspend") {
    return {
      student: {
        ...student,
        status: "suspended",
        suspendedAt: transition.changedAt,
        withdrawnAt: undefined,
      },
      event: createEvent("suspended", transition),
    };
  }

  if (transition.action === "withdraw") {
    return {
      student: {
        ...student,
        status: "withdrawn",
        suspendedAt: undefined,
        withdrawnAt: transition.changedAt,
      },
      event: createEvent("withdrawn", transition),
    };
  }

  return {
    student: {
      ...student,
      status: "enrolled",
      suspendedAt: undefined,
      withdrawnAt: undefined,
    },
    event: createEvent("reinstated", transition),
  };
}

export function calculateWithdrawnStudentRetention(
  student: StudentStatusRecord,
  options: WithdrawnStudentRetentionOptions,
): WithdrawnStudentRetention {
  if (student.status !== "withdrawn" || !student.withdrawnAt) {
    throw new Error("퇴원 원생만 보관 만료일을 계산할 수 있습니다.");
  }

  const withdrawnDate = student.withdrawnAt.slice(0, 10);
  const deletableOn = addDays(withdrawnDate, options.retentionDays);
  const daysRemaining = Math.max(
    0,
    toUtcDayNumber(deletableOn) - toUtcDayNumber(options.today),
  );

  return {
    deletableOn,
    daysRemaining,
    canDelete: daysRemaining === 0,
  };
}

function createEvent(
  type: StudentStatusTransitionEvent["type"],
  transition: StudentStatusTransition,
): StudentStatusTransitionEvent {
  return {
    type,
    reason: transition.reason,
    changedAt: transition.changedAt,
    confirmationRequired: true,
  };
}

function addDays(date: string, days: number) {
  const nextDate = new Date(toUtcDayNumber(date) * 86_400_000);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return [
    nextDate.getUTCFullYear(),
    pad2(nextDate.getUTCMonth() + 1),
    pad2(nextDate.getUTCDate()),
  ].join("-");
}

function toUtcDayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}
