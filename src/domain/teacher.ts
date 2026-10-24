export type TeacherPayType = "ratio" | "monthly" | "hourly";
export type TeacherStatus = "employed" | "on_leave" | "resigned";

export type SecureResidentRegistrationNumberRef = {
  encryptedValueRef: string;
  maskedValue: string;
};

export type TeacherWorkScheduleInput = {
  weekday: string;
  startTime?: string;
  endTime?: string;
};

export type TeacherSalarySetting =
  | {
      payType: "monthly";
      monthlySalary: number;
    }
  | {
      payType: "hourly";
      hourlyRate: number;
    }
  | {
      payType: "ratio";
      ratioTeacherShare: number;
    };

export type RegisterTeacherInput = {
  academyId: string;
  teacherId: string;
  name: string;
  part: string;
  contact: string;
  registeredAt: string;
  /** 계약기간은 선택이다. 시작일·종료일을 각각 비워 둘 수 있다. */
  contractStartOn?: string;
  contractEndOn?: string;
  residentRegistrationNumber: SecureResidentRegistrationNumberRef;
  payType: TeacherPayType;
  monthlySalary?: number;
  hourlyRate?: number;
  ratioAcademyShare?: number;
  ratioTeacherShare?: number;
  workSchedules?: TeacherWorkScheduleInput[];
};

export type TeacherRecord = RegisterTeacherInput & {
  status: TeacherStatus;
  salary: TeacherSalarySetting;
  workSchedules: TeacherWorkScheduleInput[];
  active: true;
};

const TEACHER_PAY_TYPES: TeacherPayType[] = ["ratio", "monthly", "hourly"];

export function registerTeacher(input: RegisterTeacherInput): TeacherRecord {
  const name = input.name.trim();
  const part = input.part.trim();
  const contact = input.contact.trim();
  const encryptedValueRef =
    input.residentRegistrationNumber.encryptedValueRef.trim();
  const maskedValue = input.residentRegistrationNumber.maskedValue.trim();

  if (!name) {
    throw new Error("선생님명은 필수입니다.");
  }

  if (!part) {
    throw new Error("담당 파트는 필수입니다.");
  }

  if (!contact) {
    throw new Error("연락처는 필수입니다.");
  }

  if (!encryptedValueRef || !maskedValue) {
    throw new Error("주민등록번호 보안 참조와 마스킹 값은 필수입니다.");
  }

  if (!TEACHER_PAY_TYPES.includes(input.payType)) {
    throw new Error("지원하지 않는 급여 형태입니다.");
  }

  validateContractPeriod(input.contractStartOn, input.contractEndOn);
  const salary = buildTeacherSalarySetting(input);
  const workSchedules = normalizeWorkSchedules(input.workSchedules ?? []);

  return {
    academyId: input.academyId,
    teacherId: input.teacherId,
    name,
    part,
    contact,
    registeredAt: input.registeredAt,
    contractStartOn: input.contractStartOn,
    contractEndOn: input.contractEndOn,
    residentRegistrationNumber: {
      encryptedValueRef,
      maskedValue,
    },
    payType: input.payType,
    monthlySalary: input.monthlySalary,
    hourlyRate: input.hourlyRate,
    ratioAcademyShare: input.ratioAcademyShare,
    ratioTeacherShare: input.ratioTeacherShare,
    salary,
    workSchedules,
    status: "employed",
    active: true,
  };
}

export function buildTeacherSalarySetting(
  input: Pick<
    RegisterTeacherInput,
    | "payType"
    | "monthlySalary"
    | "hourlyRate"
    | "ratioAcademyShare"
    | "ratioTeacherShare"
  >,
): TeacherSalarySetting {
  if (input.payType === "monthly") {
    if (!isPositiveMoney(input.monthlySalary)) {
      throw new Error("월급제는 월급 금액이 필요합니다.");
    }

    return {
      payType: "monthly",
      monthlySalary: Number(input.monthlySalary),
    };
  }

  if (input.payType === "hourly") {
    if (!isPositiveMoney(input.hourlyRate)) {
      throw new Error("시급제는 시급 금액이 필요합니다.");
    }

    return {
      payType: "hourly",
      hourlyRate: Number(input.hourlyRate),
    };
  }

  if (input.payType !== "ratio") {
    throw new Error("지원하지 않는 급여 형태입니다.");
  }

  const academyShare = Number(input.ratioAcademyShare);
  const teacherShare = Number(input.ratioTeacherShare);

  if (
    !Number.isFinite(academyShare) ||
    !Number.isFinite(teacherShare) ||
    !Number.isInteger(academyShare) ||
    !Number.isInteger(teacherShare) ||
    academyShare < 0 ||
    teacherShare < 0 ||
    academyShare > 10 ||
    teacherShare > 10
  ) {
    throw new Error("비율제는 0부터 10 사이의 정수로 입력해 주세요.");
  }

  if (
    academyShare + teacherShare !== 10
  ) {
    throw new Error("비율제는 학원 몫과 선생님 몫의 합계가 10이어야 합니다.");
  }

  return {
    payType: "ratio",
    ratioTeacherShare: teacherShare * 10,
  };
}

export function normalizeWorkSchedules(
  schedules: TeacherWorkScheduleInput[],
): TeacherWorkScheduleInput[] {
  return schedules.map((schedule) => {
    const startTime = schedule.startTime?.trim() || undefined;
    const endTime = schedule.endTime?.trim() || undefined;

    if (Boolean(startTime) !== Boolean(endTime)) {
      throw new Error("근무 시작 시간과 종료 시간은 함께 입력해야 합니다.");
    }

    if (startTime && endTime && startTime >= endTime) {
      throw new Error("근무 종료 시간은 시작 시간보다 늦어야 합니다.");
    }

    return {
      weekday: schedule.weekday,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
    };
  });
}

/** 계약기간은 선택이라, 시작일과 종료일이 모두 있을 때만 순서를 검사한다. */
function validateContractPeriod(contractStartOn?: string, contractEndOn?: string) {
  if (contractStartOn && contractEndOn && contractEndOn < contractStartOn) {
    throw new Error("계약 종료일은 계약 시작일보다 빠를 수 없습니다.");
  }
}

function isPositiveMoney(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
