import { describe, expect, it } from "vitest";
import type { BookSale, LedgerEntry } from "./book-sale";
import { calculateBookCashFlow, groupBookSalesByShipment } from "./book-finance";

const sale = (id: string, title: string): BookSale => ({
  academyId: "academy-1", saleId: id, bookId: id, bookTitle: title,
  studentId: "student-1", studentName: "김민지", price: 10000, quantity: 1,
  shippedAt: "2026-10-02", status: "payment-pending",
});

const ledger = (id: string, amount: number, type: LedgerEntry["type"], category: LedgerEntry["category"]): LedgerEntry => ({
  academyId: "academy-1", ledgerId: id, occurredOn: "2026-10-20", type,
  source: "manual", category, amount, description: id, refId: id,
});

describe("교재 수지", () => {
  it("같은 원생·출고일의 품목을 한 출고로 묶되 다른 날짜는 분리한다", () => {
    const groups = groupBookSalesByShipment([
      sale("1", "바이엘"), sale("2", "체르니"),
      { ...sale("3", "하농"), shippedAt: "2026-10-03" },
    ], "academy-1");
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((item) => item.bookTitle)).toEqual(["바이엘", "체르니"]);
    expect(groups[0].amount).toBe(20000);
  });

  it("삭제된 원생의 ID가 없으면 동명이인의 출고를 임의로 합치지 않는다", () => {
    const groups = groupBookSalesByShipment([
      { ...sale("1", "바이엘"), studentId: null },
      { ...sale("2", "체르니"), studentId: null },
    ], "academy-1");
    expect(groups).toHaveLength(2);
  });

  it("실제 입출금일 원장에서 교재판매와 수기·자동 교재발주 지출을 합산한다", () => {
    expect(calculateBookCashFlow([
      ledger("sale", 20000, "income", "book-sale"),
      ledger("order", 7000, "expense", "book-order"),
      ledger("manual", 2000, "expense", "book-order"),
      ledger("other", 1000, "expense", "supplies"),
      { ...ledger("last-month", 10000, "income", "book-sale"), occurredOn: "2026-09-30" },
    ], "academy-1", "2026-10")).toEqual({ income: 20000, expenses: 9000, net: 11000 });
  });
});
