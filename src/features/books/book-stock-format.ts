export function formatBookPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

export function formatBookQuantity(quantity: number) {
  return `${quantity.toLocaleString("ko-KR")}권`;
}
