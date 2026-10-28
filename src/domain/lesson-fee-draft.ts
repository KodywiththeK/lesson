import {
  calculateLessonFee,
  calculateStudentFee,
  getPrivateLessonSessionsForWeekdays,
  getProgressOptions,
  type ManualLessonFeeReason,
  type PricedLessonType,
  type PrivateLessonMinutes,
  type PrivateLessonSessions,
  type StudentDiscountKind,
} from "./lesson-pricing";
import type { StudentListInstrument } from "./student-list";

/** 원생 등록·수정 폼이 악기 하나의 진도·레슨비·할인을 다루는 상태. 계산 규칙은 `lesson-pricing`에 있다. */
export type LessonFeeDraft = {
  progress: string;
  sessionsPerMonth: PrivateLessonSessions;
  /** 0은 이전 데이터에 개인레슨 수업 길이가 저장되지 않아 사용자가 보완해야 하는 상태다. */
  minutes: PrivateLessonMinutes | 0;
  lessonFee: number;
  /** manual이면 직원이 직접 입력(또는 저장된) 금액이라 가격표 구간이 없는 동안 유지한다. */
  feeSource: "auto" | "manual";
  discountKinds: StudentDiscountKind[];
  /** 지인 소개 할인을 적용하는 달 `YYYY-MM`. null이면 폼의 기준 월(등록 달)을 따른다. */
  referralMonth: string | null;
  /** 할인 종류에 속하지 않는 기존 임의 할인. */
  otherDiscount: { amount: number; label: string };
};

export type LessonFeeContext = {
  instrumentName: string;
  lessonType: PricedLessonType;
  weekdayCount: number;
};

const DEFAULT_SESSIONS: PrivateLessonSessions = 4;
const DEFAULT_MINUTES: PrivateLessonMinutes = 40;
const LEGACY_DISCOUNT_LABEL = "기존 할인";

export function createLessonFeeDraft(context: LessonFeeContext): LessonFeeDraft {
  return repriceLessonFee(
    {
      progress: getProgressOptions(context.instrumentName, context.lessonType)[0] ?? "",
      sessionsPerMonth: DEFAULT_SESSIONS,
      minutes: DEFAULT_MINUTES,
      lessonFee: 0,
      feeSource: "auto",
      discountKinds: [],
      referralMonth: null,
      otherDiscount: { amount: 0, label: LEGACY_DISCOUNT_LABEL },
    },
    context,
  );
}

/** 저장된 수강 정보로 수정 폼 상태를 만든다. 저장된 레슨비는 진도·요일 등을 바꾸기 전까지 가격표로 덮어쓰지 않는다. */
export function createLessonFeeDraftFromInstrument(
  instrument: StudentListInstrument | undefined,
): LessonFeeDraft {
  const discountKinds = instrument?.discountKinds ?? [];
  const kindsTotal = calculateStudentFee({ lessonFee: 0, discountKinds }).monthlyDiscountTotal;
  const otherAmount = Math.max(0, (instrument?.discountTotal ?? 0) - kindsTotal);
  const keepsStoredLabel = discountKinds.length === 0 && instrument?.discountLabel;

  return {
    progress: instrument?.progress ?? "",
    sessionsPerMonth: instrument?.sessionsPerMonth ?? 0,
    minutes: instrument?.lessonDurationMinutes ?? 0,
    lessonFee: instrument?.lessonFee ?? 0,
    feeSource: "manual",
    discountKinds,
    referralMonth: instrument?.referralDiscountMonth ?? null,
    otherDiscount: {
      amount: otherAmount,
      label: keepsStoredLabel ? (instrument.discountLabel ?? LEGACY_DISCOUNT_LABEL) : LEGACY_DISCOUNT_LABEL,
    },
  };
}

/** 진도·요일 개수·월 횟수·수업 시간·수업 형태가 바뀐 뒤 레슨비를 가격표로 다시 맞춘다. */
export function repriceLessonFee(draft: LessonFeeDraft, context: LessonFeeContext): LessonFeeDraft {
  if (draft.feeSource === "manual") {
    return draft;
  }

  const result = calculateLessonFee({
    ...context,
    progress: draft.progress,
    sessionsPerMonth: draft.sessionsPerMonth,
    minutes: draft.minutes || undefined,
  });

  if (result.status === "priced") {
    return { ...draft, lessonFee: result.fee, feeSource: "auto" };
  }
  // 가격표 구간이 없어졌다면 이전 구간의 금액이 남아 잘못 청구되지 않게 비운다.
  return { ...draft, lessonFee: 0, feeSource: "auto" };
}

export function resetLessonFeeToPriceTable(
  draft: LessonFeeDraft,
  context: LessonFeeContext,
): LessonFeeDraft {
  return repriceLessonFee({ ...draft, feeSource: "auto" }, context);
}

export function updateLessonFeeWeekdayCount(
  draft: LessonFeeDraft,
  context: LessonFeeContext,
  previousWeekdayCount: number,
): LessonFeeDraft {
  if (context.lessonType !== "private") return repriceLessonFee(draft, context);

  const resolution = getPrivateLessonSessionsForWeekdays(context.weekdayCount);
  let sessionsPerMonth = draft.sessionsPerMonth;
  if (resolution.kind === "automatic") {
    sessionsPerMonth = resolution.sessions;
  } else if (previousWeekdayCount <= 2) {
    sessionsPerMonth = 0;
  }

  return repriceLessonFee({ ...draft, sessionsPerMonth }, context);
}

export function setLessonFeeManually(draft: LessonFeeDraft, lessonFee: number): LessonFeeDraft {
  return { ...draft, lessonFee, feeSource: "manual" };
}

function getPrivateSessionsForLessonTypeChange(weekdayCount: number): PrivateLessonSessions {
  if (weekdayCount === 0) return DEFAULT_SESSIONS;

  const resolution = getPrivateLessonSessionsForWeekdays(weekdayCount);
  return resolution.kind === "automatic" ? resolution.sessions : 0;
}

export function changeLessonFeeLessonType(
  draft: LessonFeeDraft,
  context: LessonFeeContext,
): LessonFeeDraft {
  return repriceLessonFee(
    {
      ...draft,
      progress: getProgressOptions(context.instrumentName, context.lessonType)[0] ?? "",
      ...(context.lessonType === "private"
        ? {
            sessionsPerMonth: getPrivateSessionsForLessonTypeChange(context.weekdayCount),
            minutes: draft.minutes || DEFAULT_MINUTES,
          }
        : {}),
      feeSource: "auto",
    },
    context,
  );
}

export type LessonFeeSubmission = {
  lessonFee: number;
  /** 매달 적용 할인 합계. 지인 소개 할인은 포함하지 않는다. */
  discountTotal: number;
  discountLabel: string | undefined;
  finalMonthlyFee: number;
  discountKinds: StudentDiscountKind[];
  referralDiscountMonth: string | undefined;
  referralDiscountAmount: number;
};

export function getLessonFeeSubmission(draft: LessonFeeDraft, referenceMonth: string): LessonFeeSubmission {
  const fee = calculateStudentFee({
    lessonFee: draft.lessonFee,
    discountKinds: draft.discountKinds,
    otherDiscount: draft.otherDiscount,
  });
  const hasReferral = draft.discountKinds.includes("referral");

  return {
    lessonFee: draft.lessonFee,
    discountTotal: fee.monthlyDiscountTotal,
    discountLabel: fee.discountLabel,
    finalMonthlyFee: fee.finalMonthlyFee,
    discountKinds: draft.discountKinds,
    referralDiscountMonth: hasReferral ? draft.referralMonth ?? (referenceMonth || undefined) : undefined,
    referralDiscountAmount: fee.referralDiscountAmount,
  };
}

export function isReferralMonthMissing(draft: LessonFeeDraft, referenceMonth: string) {
  return draft.discountKinds.includes("referral") && !(draft.referralMonth ?? referenceMonth);
}

const MANUAL_LESSON_FEE_MESSAGES: Record<ManualLessonFeeReason, string> = {
  "no-weekdays": "수강 요일을 선택하면 레슨비가 자동으로 계산됩니다.",
  "no-weekday-tier": "요일 개수에 맞는 가격표가 없어 레슨비를 직접 입력해 주세요.",
  "unknown-progress": "가격표에 없는 진도라 레슨비를 직접 입력해 주세요.",
  "missing-private-option": "월 횟수와 수업 시간을 선택하면 레슨비가 자동으로 계산됩니다.",
  "no-private-session-tier": "가격표에 없는 월 횟수라 레슨비를 직접 입력해 주세요.",
  "no-private-minute-tier": "이 수업 시간은 가격표에 없어 레슨비를 직접 입력해 주세요.",
  "no-price-table": "이 수업은 가격표가 없어 레슨비를 직접 입력해 주세요.",
};

export function describeManualLessonFee(reason: ManualLessonFeeReason) {
  return MANUAL_LESSON_FEE_MESSAGES[reason];
}
