/**
 * 회차권 삭제(환불 처리)의 순수 규칙. 서버 RPC(`get_lesson_ticket_refund_preview`, `delete_lesson_ticket`)와
 * 데모 상태가 같은 기대값을 쓰도록 UI 밖에 둔다. 규칙은 `docs/product/functional-spec.md`의 회차권 장을 따른다.
 */

export const LESSON_TICKET_REFUND_POLICIES = ["none", "proportional_until_half", "proportional_always"] as const;

export type LessonTicketRefundPolicy = (typeof LESSON_TICKET_REFUND_POLICIES)[number];

/** 설정하지 않은 학원은 환불하지 않는다. DB 기본값(`academy_settings`)과 같다. */
export const DEFAULT_LESSON_TICKET_REFUND_POLICY: LessonTicketRefundPolicy = "none";

export const LESSON_TICKET_REFUND_POLICY_OPTIONS: ReadonlyArray<{
  value: LessonTicketRefundPolicy;
  label: string;
  description: string;
}> = [
  {
    value: "proportional_always",
    label: "언제든 남은 회수 비례 환불",
    description: "사용한 횟수와 상관없이 남은 회수 비율만큼 결제 금액을 돌려줍니다.",
  },
  {
    value: "proportional_until_half",
    label: "반 이하 사용 시에만 남은 회수 비례 환불",
    description: "부여한 회수의 절반 이하를 썼을 때만 남은 회수 비율만큼 돌려줍니다. 절반을 넘기면 환불하지 않습니다.",
  },
  {
    value: "none",
    label: "환불 불가",
    description: "한 번 결제한 회차권은 환불하지 않습니다. 삭제해도 수입 내역은 그대로 남습니다.",
  },
];

export function formatLessonTicketRefundPolicy(policy: LessonTicketRefundPolicy) {
  return LESSON_TICKET_REFUND_POLICY_OPTIONS.find((option) => option.value === policy)?.label ?? policy;
}

export type LessonTicketRefundQuoteInput = {
  policy: LessonTicketRefundPolicy;
  totalGrantedCount: number;
  remainingCount: number;
  /** 등록(결제)마다 처음 입력한 결제 금액. 결제가 없으면 0 또는 비어 있다. */
  paidAmounts: number[];
};

export type LessonTicketRefundQuote = {
  policy: LessonTicketRefundPolicy;
  totalGrantedCount: number;
  usedCount: number;
  /** 규정이 환불을 허용하는지. 허용해도 돌려줄 금액은 0원일 수 있다. */
  eligible: boolean;
  refundAmount: number;
};

/** 규정에 맞는지 검사하고 환불액(결제 합계 × 남은 회수 / 부여 회수, 원 단위 반올림)을 계산한다. */
export function quoteLessonTicketRefund(input: LessonTicketRefundQuoteInput): LessonTicketRefundQuote {
  const total = Math.max(0, input.totalGrantedCount);
  const remaining = Math.min(Math.max(0, input.remainingCount), total);
  const usedCount = total - remaining;
  const eligible = isRefundAllowed(input.policy, usedCount, total);
  const paidTotal = input.paidAmounts.reduce((sum, amount) => sum + amount, 0);

  return {
    policy: input.policy,
    totalGrantedCount: total,
    usedCount,
    eligible,
    refundAmount: eligible ? roundedShare(paidTotal, remaining, total) : 0,
  };
}

function isRefundAllowed(policy: LessonTicketRefundPolicy, usedCount: number, total: number) {
  if (policy === "proportional_always") return true;
  if (policy === "proportional_until_half") return usedCount * 2 <= total;

  return false;
}

/**
 * amount × part / whole을 반올림(.5는 올림)한다. 금액이 21억에 가까워도 곱이 안전 정수를 넘지 않도록
 * 몫과 나머지로 나눠 계산한다(서버의 numeric 반올림과 같은 값).
 */
function roundedShare(amount: number, part: number, whole: number) {
  if (whole <= 0 || amount <= 0 || part <= 0) return 0;

  const quotient = Math.floor(amount / whole);
  const remainder = amount - quotient * whole;

  return quotient * part + Math.round((remainder * part) / whole);
}

export type LessonTicketRefundRegistration = {
  registrationId: string;
  paidAmount: number;
};

export type LessonTicketRefundAllocation = {
  registrationId: string;
  paidAmount: number;
  refundAmount: number;
  /** 감액 뒤 수입 행 금액. 0이면 수입 행을 지운다(원장 금액은 0원이 될 수 없다). */
  remainingAmount: number;
};

/**
 * 환불액을 가장 최근 결제부터 거꾸로 감액한다. 반올림 오차 없이 합계가 환불액과 정확히 같고,
 * 결제가 없는 등록과 감액이 없는 등록은 결과에 넣지 않는다. `registrations`는 오래된 순이다.
 */
export function allocateLessonTicketRefund(
  registrations: LessonTicketRefundRegistration[],
  refundAmount: number,
): LessonTicketRefundAllocation[] {
  const allocations: LessonTicketRefundAllocation[] = [];
  let left = refundAmount;

  for (const registration of [...registrations].reverse()) {
    if (left <= 0) break;
    if (registration.paidAmount <= 0) continue;

    const reduced = Math.min(registration.paidAmount, left);

    left -= reduced;
    allocations.push({
      registrationId: registration.registrationId,
      paidAmount: registration.paidAmount,
      refundAmount: reduced,
      remainingAmount: registration.paidAmount - reduced,
    });
  }

  return allocations;
}

/** 잘못 등록한 회차권만 수입 기록까지 지울 수 있다. 한 번이라도 썼으면(회수가 줄었거나 사용 기록이 있으면) 막는다. */
export function canDeleteLessonTicketAsMistake(input: {
  totalGrantedCount: number;
  remainingCount: number;
  hasUsageRecords: boolean;
}) {
  return input.remainingCount >= input.totalGrantedCount && !input.hasUsageRecords;
}
