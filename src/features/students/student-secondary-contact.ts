const MIN_PHONE_DIGITS = 4;

export function getSecondaryContactErrors(relationship: string, phone: string) {
  const hasRelationship = relationship.trim() !== "";
  const hasPhone = phone.trim() !== "";

  if (!hasRelationship && !hasPhone) return {};
  if (!hasRelationship) return { relationship: "두 번째 연락처 구분을 선택해 주세요." };
  if (!hasPhone) return { phone: "두 번째 연락처 번호를 입력해 주세요." };
  if (phone.replace(/\D/g, "").length < MIN_PHONE_DIGITS) {
    return { phone: "두 번째 연락처는 숫자 4자리 이상 입력해 주세요." };
  }
  return {};
}
