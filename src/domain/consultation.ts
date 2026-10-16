/** 상담 기록의 악기 표기. 원생 등록 폼의 악기 목록·순서와 같아야 한다. */
export const CONSULTATION_INSTRUMENT_NAMES = ["피아노", "바이올린", "첼로", "플루트"] as const;

/** 접수일로부터 이 기간이 지난 상담 기록은 개인정보 보관 기간이 끝나 삭제 대상이 된다. */
export const CONSULTATION_RETENTION_YEARS = 1;

/** 원생 등록이 요구하는 연락처 최소 자릿수와 같다. */
export const CONSULTATION_PHONE_MIN_DIGITS = 4;
export const CONSULTATION_MAX_AGE = 150;
export const CONSULTATION_MAX_LENGTH = {
  name: 50,
  school: 100,
  phone: 30,
  memo: 2000,
} as const;

/** 저장·수정 폼이 다루는 상담 기록 내용. 접수일은 서버가 정하므로 포함하지 않는다. */
export type ConsultationProfile = {
  name: string;
  age?: number;
  instrumentNames: string[];
  phone: string;
  school: string;
  memo: string;
};

/** 폼 입력 상태. 숫자 입력도 문자열로 들고 있다가 검증 때 숫자로 바꾼다. */
export type ConsultationFormValues = Omit<ConsultationProfile, "age"> & { age: string };

export type ConsultationValidation =
  | { ok: true; profile: ConsultationProfile }
  | { ok: false; reason: string };

export function validateConsultationForm(values: ConsultationFormValues): ConsultationValidation {
  const name = values.name.trim();
  const phone = values.phone.trim();
  const school = values.school.trim();
  const memo = values.memo.trim();

  if (!name) {
    return invalid("이름을 입력해 주세요.");
  }

  if (countDigits(phone) < CONSULTATION_PHONE_MIN_DIGITS) {
    return invalid(`전화번호를 숫자 ${CONSULTATION_PHONE_MIN_DIGITS}자리 이상 입력해 주세요.`);
  }

  const age = parseAge(values.age);
  if (Number.isNaN(age)) {
    return invalid(`나이는 0~${CONSULTATION_MAX_AGE} 사이의 숫자로 입력해 주세요.`);
  }

  const tooLongField = findTooLongField({ name, school, phone, memo });
  if (tooLongField) {
    return invalid(
      `${tooLongField.topic} ${CONSULTATION_MAX_LENGTH[tooLongField.key]}자 이하로 입력해 주세요.`,
    );
  }

  return {
    ok: true,
    profile: {
      name,
      age,
      instrumentNames: CONSULTATION_INSTRUMENT_NAMES.filter((instrument) =>
        values.instrumentNames.includes(instrument),
      ),
      phone,
      school,
      memo,
    },
  };
}

export function toConsultationFormValues(profile: ConsultationProfile): ConsultationFormValues {
  return {
    name: profile.name,
    age: profile.age === undefined ? "" : String(profile.age),
    instrumentNames: profile.instrumentNames,
    phone: profile.phone,
    school: profile.school,
    memo: profile.memo,
  };
}

/** 이 시각(포함)보다 일찍 접수된 상담 기록은 보관 기간이 지났다. DB의 `now() - interval '1 year'`와 같은 기준이다. */
export function getConsultationRetentionCutoff(now: Date): string {
  const year = now.getUTCFullYear() - CONSULTATION_RETENTION_YEARS;
  const month = now.getUTCMonth();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDayOfMonth);

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  ).toISOString();
}

export function isConsultationExpired(receivedAt: string, now: Date): boolean {
  return new Date(receivedAt).getTime() < new Date(getConsultationRetentionCutoff(now)).getTime();
}

function invalid(reason: string): ConsultationValidation {
  return { ok: false, reason };
}

function countDigits(value: string) {
  return value.replace(/\D/g, "").length;
}

/** 빈 입력은 `undefined`, 올바르지 않은 입력은 `NaN`이다. */
function parseAge(value: string) {
  const text = value.trim();
  if (!text) {
    return undefined;
  }

  const age = Number(text);
  return Number.isInteger(age) && age >= 0 && age <= CONSULTATION_MAX_AGE ? age : Number.NaN;
}

const LENGTH_LIMITED_FIELDS = [
  { key: "name", topic: "이름은" },
  { key: "school", topic: "학교는" },
  { key: "phone", topic: "전화번호는" },
  { key: "memo", topic: "특이사항은" },
] as const;

function findTooLongField(values: Record<keyof typeof CONSULTATION_MAX_LENGTH, string>) {
  return LENGTH_LIMITED_FIELDS.find(
    (field) => values[field.key].length > CONSULTATION_MAX_LENGTH[field.key],
  );
}
