import { getStudentDisplayAge, type StudentListRow } from "@/domain/student-list";
import { getFinanceToday } from "@/domain/finance-date";
import { getStudentDisplayGrade } from "@/domain/student-grade";
import type { StudentBasicInfoInput } from "@/domain/student-enrollment-edit";

import { contactRelationshipOptions } from "./student-form-options";

const MIN_PHONE_DIGITS = 4;
const DEFAULT_CONTACT_RELATIONSHIP = "모";

/** 수정 폼의 이름·기본 정보·연락처 입력값. 나이는 입력 중인 문자열이다. */
export type StudentBasicFormValues = {
  name: string;
  registeredOn: string;
  age: string;
  grade: string;
  school: string;
  occupation: string;
  contactRelationship: string;
  contactPhone: string;
  secondaryContactRelationship: string;
  secondaryContactPhone: string;
};

export function createBasicFormValues(student: StudentListRow): StudentBasicFormValues {
  const primaryContact = student.contacts?.[0];
  const secondaryContact = student.contacts?.[1];
  const displayAge = getStudentDisplayAge(student);

  return {
    name: student.name,
    registeredOn: student.registeredOn ?? "",
    age: displayAge === undefined ? "" : String(displayAge),
    grade: getStudentDisplayGrade(student, getFinanceToday()),
    school: student.school ?? "",
    occupation: student.occupation ?? "",
    contactRelationship: primaryContact?.relationship || DEFAULT_CONTACT_RELATIONSHIP,
    contactPhone: primaryContact?.phone ?? "",
    secondaryContactRelationship: secondaryContact?.relationship ?? "",
    secondaryContactPhone: secondaryContact?.phone ?? "",
  };
}

/** 이름은 따로 저장하므로 기본 정보 저장 값에는 담지 않는다. */
export function toBasicInfoInput(values: StudentBasicFormValues): StudentBasicInfoInput {
  return {
    registeredOn: values.registeredOn,
    age: values.age ? Number(values.age) : undefined,
    grade: values.grade,
    school: values.school,
    occupation: values.occupation,
    contactRelationship: values.contactRelationship,
    contactPhone: values.contactPhone,
    secondaryContactRelationship: values.secondaryContactRelationship,
    secondaryContactPhone: values.secondaryContactPhone,
  };
}

export function hasBasicInfoChanged(current: StudentBasicFormValues, initial: StudentBasicFormValues) {
  return JSON.stringify(toBasicInfoInput(current)) !== JSON.stringify(toBasicInfoInput(initial));
}

/** 연락처가 이미 있던 원생은 비울 수 없고, 없던 원생은 비워 둘 수 있다. */
export function getContactPhoneError(phone: string, hasExistingContact: boolean) {
  const digits = phone.replace(/\D/g, "").length;

  if (!hasExistingContact && phone.trim() === "") {
    return null;
  }

  return digits >= MIN_PHONE_DIGITS ? null : "연락처는 숫자 4자리 이상 입력해 주세요.";
}

/** 저장된 관계가 기본 선택지에 없어도 그대로 보여 주고 유지한다. */
export function getRelationshipChoices(current: string) {
  return contactRelationshipOptions.includes(current)
    ? contactRelationshipOptions
    : [...contactRelationshipOptions, current];
}
