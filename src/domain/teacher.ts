export type TeacherPayType = "ratio" | "monthly" | "hourly";

export type SecureResidentRegistrationNumberRef = {
  encryptedValueRef: string;
  maskedValue: string;
};

export type RegisterTeacherInput = {
  academyId: string;
  teacherId: string;
  name: string;
  part: string;
  contact: string;
  registeredAt: string;
  residentRegistrationNumber: SecureResidentRegistrationNumberRef;
  payType: TeacherPayType;
};

export type TeacherRecord = RegisterTeacherInput & {
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

  return {
    academyId: input.academyId,
    teacherId: input.teacherId,
    name,
    part,
    contact,
    registeredAt: input.registeredAt,
    residentRegistrationNumber: {
      encryptedValueRef,
      maskedValue,
    },
    payType: input.payType,
    active: true,
  };
}
