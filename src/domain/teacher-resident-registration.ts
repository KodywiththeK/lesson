const RESIDENT_REGISTRATION_DIGITS = 13;
const BIRTH_DATE_DIGITS = 6;

const FORMAT_MESSAGE = "주민등록번호는 숫자 13자리(######-#######)로 입력해 주세요.";
const BIRTH_DATE_MESSAGE = "주민등록번호 앞 6자리가 올바른 생년월일이 아닙니다.";
const GENDER_MESSAGE = "주민등록번호 성별 자리(뒤 첫 숫자)는 1~8이어야 합니다.";

/** 성별 자리 1·2·5·6은 1900년대, 3·4·7·8은 2000년대 출생이다(5~8은 외국인 등록번호). */
const BIRTH_CENTURY_BY_GENDER_DIGIT: Record<string, number> = {
  "1": 1900,
  "2": 1900,
  "3": 2000,
  "4": 2000,
  "5": 1900,
  "6": 1900,
  "7": 2000,
  "8": 2000,
};

/** `format`은 13자리를 다 채우기 전에도 나오는 입력 중 상태이고, 나머지는 13자리를 채운 뒤의 값 오류다. */
export type ResidentRegistrationFailureCode = "format" | "gender" | "birth-date";

export type ResidentRegistrationValidation =
  | { ok: true; normalized: string }
  | { ok: false; code: ResidentRegistrationFailureCode; reason: string };

/** 입력 중인 값에서 숫자만 남기고 13자리까지 자른 뒤, 7번째 숫자부터 앞 6자리 뒤에 하이픈을 붙인다. */
export function formatResidentRegistrationInput(raw: string): string {
  const digits = readDigits(raw).slice(0, RESIDENT_REGISTRATION_DIGITS);

  return digits.length > BIRTH_DATE_DIGITS
    ? `${digits.slice(0, BIRTH_DATE_DIGITS)}-${digits.slice(BIRTH_DATE_DIGITS)}`
    : digits;
}

/** 형식(13자리)·성별 자리·생년월일을 차례로 확인하고, 통과하면 `######-#######`로 정규화한 값을 돌려준다. */
export function validateResidentRegistration(raw: string): ResidentRegistrationValidation {
  const digits = readDigits(raw);

  if (digits.length !== RESIDENT_REGISTRATION_DIGITS) {
    return { ok: false, code: "format", reason: FORMAT_MESSAGE };
  }

  const century = BIRTH_CENTURY_BY_GENDER_DIGIT[digits[BIRTH_DATE_DIGITS]];

  if (century === undefined) {
    return { ok: false, code: "gender", reason: GENDER_MESSAGE };
  }

  const year = century + Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));

  if (!isRealDate(year, month, day)) {
    return { ok: false, code: "birth-date", reason: BIRTH_DATE_MESSAGE };
  }

  return { ok: true, normalized: formatResidentRegistrationInput(digits) };
}

/** 화면에는 항상 이 값만 보여 준다(`900101-1******`). 13자리가 아니면 가릴 수 없으므로 빈 문자열이다. */
export function maskResidentRegistration(value: string): string {
  const digits = readDigits(value);

  if (digits.length !== RESIDENT_REGISTRATION_DIGITS) {
    return "";
  }

  return `${digits.slice(0, BIRTH_DATE_DIGITS)}-${digits[BIRTH_DATE_DIGITS]}******`;
}

function readDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isRealDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
