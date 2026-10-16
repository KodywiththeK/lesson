export type PricedLessonType = "academy" | "private";

export const PRIVATE_LESSON_SESSION_OPTIONS = [4, 8] as const;
export const PRIVATE_LESSON_MINUTE_OPTIONS = [40, 60] as const;

export type PrivateLessonSessions = (typeof PRIVATE_LESSON_SESSION_OPTIONS)[number];
export type PrivateLessonMinutes = (typeof PRIVATE_LESSON_MINUTE_OPTIONS)[number];

/** 학원 피아노 레슨비 구간: 주2회, 주3회, 주4·5회 순서. */
type AcademyFeeRow = readonly [week2: number, week3: number, week45: number];
/** 개인 레슨비: 월4회 40분, 월4회 60분, 월8회 40분, 월8회 60분 순서. */
type PrivateFeeRow = readonly [m4x40: number, m4x60: number, m8x40: number, m8x60: number];

/**
 * 학원 피아노 레슨비(원). 명세 그대로이며 체르니100의 주2회·주3회가 같은 150,000원인 점은 확인이 필요하다.
 */
const ACADEMY_PIANO_FEES: Record<string, AcademyFeeRow> = {
  바이엘: [140000, 150000, 160000],
  체르니100: [150000, 150000, 170000],
  체르니30: [160000, 170000, 180000],
  체르니40: [170000, 180000, 190000],
  작품반: [180000, 190000, 200000],
};

const SUZUKI_FEES: Record<string, PrivateFeeRow> = {
  "스즈키 1~3권": [140000, 210000, 280000, 420000],
  "스즈키 4~6권": [150000, 220000, 300000, 440000],
  "스즈키 7~10권": [160000, 230000, 320000, 460000],
};

const PRIVATE_FEES_BY_INSTRUMENT: Record<string, Record<string, PrivateFeeRow>> = {
  피아노: { "피아노 개인 레슨": [140000, 210000, 280000, 420000] },
  바이올린: SUZUKI_FEES,
  첼로: SUZUKI_FEES,
  플루트: {
    초급: [140000, 210000, 280000, 420000],
    중급: [150000, 220000, 300000, 440000],
    고급: [160000, 230000, 320000, 460000],
  },
};

/** 학원 피아노 레슨비 구간이 있는 수강 요일 개수. */
const MIN_ACADEMY_WEEKDAYS = 2;
const WEEK_2_COUNT = 2;
const WEEK_3_COUNT = 3;
const MAX_ACADEMY_WEEKDAYS = 5;

export function getProgressOptions(
  instrumentName: string,
  lessonType: PricedLessonType,
): string[] {
  if (instrumentName === "피아노" && lessonType === "academy") {
    return Object.keys(ACADEMY_PIANO_FEES);
  }
  if (lessonType !== "private") {
    return [];
  }

  return Object.keys(PRIVATE_FEES_BY_INSTRUMENT[instrumentName] ?? {});
}

export type LessonFeeInput = {
  instrumentName: string;
  lessonType: PricedLessonType;
  progress: string;
  /** 학원 피아노 레슨비 구간을 정하는 선택한 수강 요일 개수. */
  weekdayCount: number;
  /** 개인 레슨 계열 레슨비를 정하는 월 횟수와 수업 시간. */
  sessionsPerMonth?: PrivateLessonSessions;
  minutes?: PrivateLessonMinutes;
};

export type ManualLessonFeeReason =
  | "no-weekdays"
  | "no-weekday-tier"
  | "unknown-progress"
  | "missing-private-option"
  | "no-price-table";

export type LessonFeeResult =
  | { status: "priced"; fee: number }
  | { status: "manual"; reason: ManualLessonFeeReason };

/**
 * 가격표로 레슨비를 계산한다. 가격표에 없는 조합은 임의 금액을 만들지 않고 직접 입력 상태로 돌려준다.
 */
export function calculateLessonFee(input: LessonFeeInput): LessonFeeResult {
  if (input.instrumentName === "피아노" && input.lessonType === "academy") {
    return calculateAcademyPianoFee(input);
  }
  if (input.lessonType === "private") {
    return calculatePrivateLessonFee(input);
  }

  return { status: "manual", reason: "no-price-table" };
}

function calculateAcademyPianoFee({ progress, weekdayCount }: LessonFeeInput): LessonFeeResult {
  const row = ACADEMY_PIANO_FEES[progress];

  if (weekdayCount === 0) {
    return { status: "manual", reason: "no-weekdays" };
  }
  if (!row) {
    return { status: "manual", reason: "unknown-progress" };
  }
  if (weekdayCount < MIN_ACADEMY_WEEKDAYS || weekdayCount > MAX_ACADEMY_WEEKDAYS) {
    return { status: "manual", reason: "no-weekday-tier" };
  }
  if (weekdayCount === WEEK_2_COUNT) {
    return { status: "priced", fee: row[0] };
  }

  return { status: "priced", fee: weekdayCount === WEEK_3_COUNT ? row[1] : row[2] };
}

function calculatePrivateLessonFee({
  instrumentName,
  progress,
  sessionsPerMonth,
  minutes,
}: LessonFeeInput): LessonFeeResult {
  const feesByProgress = PRIVATE_FEES_BY_INSTRUMENT[instrumentName];

  if (!feesByProgress) {
    return { status: "manual", reason: "no-price-table" };
  }
  const row = feesByProgress[progress];

  if (!row) {
    return { status: "manual", reason: "unknown-progress" };
  }
  if (!sessionsPerMonth || !minutes) {
    return { status: "manual", reason: "missing-private-option" };
  }

  const sessionOffset = sessionsPerMonth === 8 ? 2 : 0;
  const minuteOffset = minutes === 60 ? 1 : 0;

  return { status: "priced", fee: row[sessionOffset + minuteOffset] };
}

export const STUDENT_DISCOUNT_AMOUNT = 10000;

export type StudentDiscountKind = "sibling" | "multi_instrument" | "referral";

type StudentDiscountPolicy = {
  kind: StudentDiscountKind;
  label: string;
  /** monthly는 매달 적용, referral-month는 소개한 달에만 적용한다. */
  scope: "monthly" | "referral-month";
  amount: number;
};

export const STUDENT_DISCOUNTS: readonly StudentDiscountPolicy[] = [
  { kind: "sibling", label: "두 자녀 할인", scope: "monthly", amount: STUDENT_DISCOUNT_AMOUNT },
  { kind: "multi_instrument", label: "두 악기 할인", scope: "monthly", amount: STUDENT_DISCOUNT_AMOUNT },
  { kind: "referral", label: "지인 소개 할인", scope: "referral-month", amount: STUDENT_DISCOUNT_AMOUNT },
];

export type StudentFeeInput = {
  lessonFee: number;
  discountKinds: readonly StudentDiscountKind[];
  /** 할인 종류에 속하지 않는 기존 임의 할인. 매달 적용하며 라벨은 표시용이다. */
  otherDiscount?: { amount: number; label: string };
};

export type StudentFee = {
  /** 매달 적용 할인 합계(`discount_total`에 저장하는 값). */
  monthlyDiscountTotal: number;
  /** 소개한 달에만 추가로 빠지는 금액. 매달 수강료에는 들어가지 않는다. */
  referralDiscountAmount: number;
  finalMonthlyFee: number;
  discountLabel: string | undefined;
};

export function calculateStudentFee(input: StudentFeeInput): StudentFee {
  const selected = STUDENT_DISCOUNTS.filter((discount) => input.discountKinds.includes(discount.kind));
  const otherAmount = input.otherDiscount?.amount ?? 0;
  const monthlyDiscountTotal =
    sumAmounts(selected.filter((discount) => discount.scope === "monthly")) + otherAmount;
  const labels = [
    ...selected.map((discount) => discount.label),
    ...(otherAmount > 0 && input.otherDiscount ? [input.otherDiscount.label] : []),
  ];

  return {
    monthlyDiscountTotal,
    referralDiscountAmount: sumAmounts(selected.filter((discount) => discount.scope === "referral-month")),
    finalMonthlyFee: Math.max(0, input.lessonFee - monthlyDiscountTotal),
    discountLabel: labels.length > 0 ? labels.join(", ") : undefined,
  };
}

function sumAmounts(discounts: readonly StudentDiscountPolicy[]) {
  return discounts.reduce((total, discount) => total + discount.amount, 0);
}
