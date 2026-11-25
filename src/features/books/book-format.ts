/** 출고·결제 완료 표가 같이 쓰는 금액·수량 표기. */
export { formatWon } from "@/domain/money-input";

export function formatQuantity(quantity: number) {
  return `${quantity.toLocaleString("ko-KR")}권`;
}
