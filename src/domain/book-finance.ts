import type { BookSale, LedgerEntry } from "./book-sale";
import { calculateBookAmount } from "./book-stock";

export type BookSaleGroup = {
  id: string;
  studentName: string;
  shippedAt: string;
  items: BookSale[];
  amount: number;
};

export function groupBookSalesByShipment(sales: BookSale[], academyId: string): BookSaleGroup[] {
  const groups = new Map<string, BookSaleGroup>();
  for (const sale of sales) {
    if (sale.academyId !== academyId) continue;
    const key = sale.studentId
      ? `${sale.studentId}:${sale.studentName}:${sale.shippedAt}`
      : `unknown:${sale.saleId}`;
    const group = groups.get(key) ?? {
      id: key,
      studentName: sale.studentName,
      shippedAt: sale.shippedAt,
      items: [],
      amount: 0,
    };
    group.items.push(sale);
    group.amount += calculateBookAmount(sale.price, sale.quantity);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function calculateBookCashFlow(entries: LedgerEntry[], academyId: string, month: string) {
  const relevant = entries.filter((entry) =>
    entry.academyId === academyId && entry.occurredOn.startsWith(month),
  );
  const income = relevant.filter((entry) => entry.type === "income" && entry.category === "book-sale")
    .reduce((total, entry) => total + entry.amount, 0);
  const expenses = relevant.filter((entry) => entry.type === "expense" && entry.category === "book-order")
    .reduce((total, entry) => total + entry.amount, 0);
  return { income, expenses, net: income - expenses };
}
