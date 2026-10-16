/** 출고·결제 완료 표가 같이 쓰는 금액·수량 표기. */
export function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatQuantity(quantity: number) {
  return `${quantity.toLocaleString("ko-KR")}권`;
}
