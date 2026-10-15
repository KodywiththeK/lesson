/** 숫자 입력칸의 글자를 숫자로 바꾼다. 비어 있거나 숫자가 아니면 NaN이라 도메인 검증이 거절한다. */
export function parseNumberInput(text: string) {
  return text.trim() === "" ? Number.NaN : Number(text);
}
