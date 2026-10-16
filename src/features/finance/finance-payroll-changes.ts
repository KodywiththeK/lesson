/**
 * 지급 완료 급여가 반영한 수업과 지금 등원 기록으로 다시 계산한 수업이 다른지 비교한다.
 * 지급액은 지급 때 확정되므로 달라져도 금액을 바꾸지 않고 화면에서 알리기만 한다.
 */
export function hasLessonRecordChangedSincePayment(paidLessonEventIds: string[], currentLessonEventIds: string[]) {
  const paid = new Set(paidLessonEventIds);
  const current = new Set(currentLessonEventIds);

  return paid.size !== current.size || [...paid].some((id) => !current.has(id));
}
