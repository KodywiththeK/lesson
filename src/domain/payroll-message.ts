export const PAYROLL_MESSAGE_FIELDS = [
  "선생님", "월", "악기", "수업횟수", "정산총액", "원천징수액", "실수령액", "학생별내역",
] as const;

export type PayrollMessageField = typeof PAYROLL_MESSAGE_FIELDS[number];
export type PayrollMessageValues = Partial<Record<PayrollMessageField, string>>;

export const DEFAULT_PAYROLL_MESSAGE_TEMPLATE = `[{월}월 {악기} 강사료 정산 안내]

안녕하세요, {선생님} 선생님! {월}월 정산 내역입니다.

■ 총 정산 요약
- 총 수업 횟수: {수업횟수}회
- 정산 총액 (공제 전): {정산총액}원
- 3.3% 원천징수 세액: -{원천징수액}원
- 최종 실수령액: {실수령액}원

■ 학생별 세부 내역
{학생별내역}

■ 세부 산출 내역
- 강사료 합계: {정산총액}원
- 공제 세금 (3.3%): {원천징수액}원
- 실제 입금액: {실수령액}원

확인해 보시고 문의 사항이 있으시면 편하게 말씀해 주세요. 이번 달도 고생 많으셨습니다. 감사합니다!`;

export function validatePayrollTemplate(template: string): string[] {
  const valid = new Set<string>(PAYROLL_MESSAGE_FIELDS);
  return [...new Set([...template.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).filter((field) => !valid.has(field)))];
}

export function renderPayrollMessage(template: string, values: PayrollMessageValues): string {
  if (validatePayrollTemplate(template).length > 0) throw new Error("지원하지 않는 변수가 있습니다.");
  return template.replace(/\{([^{}]+)\}/g, (_, field: PayrollMessageField) => values[field] ?? "확인 필요");
}

/** 소수 금액의 원 단위 차액을 소수점이 큰 순서로 배분한다. */
export function allocatePayrollAmounts(items: Array<{ id: string; amount: number }>, total: number) {
  if (!Number.isInteger(total) || total < 0 || items.some((item) => !Number.isFinite(item.amount) || item.amount < 0)) {
    throw new Error("정산 총액을 확인해 주세요.");
  }
  const rows = items.map((item, index) => ({ ...item, index, floor: Math.floor(item.amount) }));
  const unroundedTotal = rows.reduce((sum, item) => sum + item.amount, 0);
  if (Math.floor(Math.round(unroundedTotal * 1_000_000) / 1_000_000) !== total) {
    throw new Error("학생별 금액과 정산 총액이 일치하지 않습니다.");
  }
  const extra = total - rows.reduce((sum, item) => sum + item.floor, 0);
  if (extra < 0 || extra > rows.length) throw new Error("학생별 금액과 정산 총액이 일치하지 않습니다.");
  const ranked = [...rows].sort((a, b) => (b.amount - b.floor) - (a.amount - a.floor) || a.id.localeCompare(b.id) || a.index - b.index);
  const incremented = new Set(ranked.slice(0, extra).map((item) => item.index));
  return rows.map((item) => ({ id: item.id, amount: item.floor + Number(incremented.has(item.index)) }));
}
