const WON_TEXT_PATTERN = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;

/** 쉼표는 세 자리 단위일 때만 허용한다. 입력 중인 빈 문자열은 아직 금액이 아니다. */
export function parseWonInput(text: string): number | null {
  const trimmed = text.trim();
  if (!WON_TEXT_PATTERN.test(trimmed)) return null;

  const amount = Number(trimmed.replaceAll(",", ""));
  return Number.isSafeInteger(amount) ? amount : null;
}
