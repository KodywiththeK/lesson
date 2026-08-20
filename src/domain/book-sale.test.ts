import { describe, expect, it } from "vitest";

import {
  type BookStock,
  completeBookSalePayment,
  registerBookStock,
  shipBookToStudent,
} from "./book-sale";

describe("registerBookStock", () => {
  it("교재명, 가격, 수량, 입고일로 재고 기록을 만든다", () => {
    const stock = registerBookStock({
      academyId: "academy-1",
      bookId: "book-1",
      title: "바이엘 2",
      price: 12000,
      quantity: 2,
      stockedAt: "2026-08-20",
    });

    expect(stock).toEqual({
      academyId: "academy-1",
      bookId: "book-1",
      title: "바이엘 2",
      price: 12000,
      quantity: 2,
      stockedAt: "2026-08-20",
      visible: true,
    });
  });
});

describe("shipBookToStudent", () => {
  const stock: BookStock = {
    academyId: "academy-1",
    bookId: "book-1",
    title: "바이엘 2",
    price: 12000,
    quantity: 2,
    stockedAt: "2026-08-20",
    visible: true,
  };

  it("교재를 원생에게 출고하면 재고를 1 줄이고 결제 대기 판매를 만든다", () => {
    const result = shipBookToStudent(stock, {
      academyId: "academy-1",
      saleId: "sale-1",
      studentId: "student-1",
      studentName: "김민지",
      shippedAt: "2026-08-21",
    });

    expect(result.stock.quantity).toBe(1);
    expect(result.sale).toEqual({
      academyId: "academy-1",
      saleId: "sale-1",
      bookId: "book-1",
      bookTitle: "바이엘 2",
      studentId: "student-1",
      studentName: "김민지",
      price: 12000,
      shippedAt: "2026-08-21",
      status: "payment-pending",
    });
  });

  it("재고가 0이 되어도 재고 기록은 보이는 상태로 유지한다", () => {
    const result = shipBookToStudent(
      {
        ...stock,
        quantity: 1,
      },
      {
        academyId: "academy-1",
        saleId: "sale-1",
        studentId: "student-1",
        studentName: "김민지",
        shippedAt: "2026-08-21",
      },
    );

    expect(result.stock.quantity).toBe(0);
    expect(result.stock.visible).toBe(true);
  });

  it("다른 학원의 재고는 출고하지 못한다", () => {
    expect(() =>
      shipBookToStudent(stock, {
        academyId: "academy-2",
        saleId: "sale-1",
        studentId: "student-1",
        studentName: "김민지",
        shippedAt: "2026-08-21",
      }),
    ).toThrow("학원 범위가 일치하지 않습니다.");
  });
});

describe("completeBookSalePayment", () => {
  const pendingSale = {
    academyId: "academy-1",
    saleId: "sale-1",
    bookId: "book-1",
    bookTitle: "바이엘 2",
    studentId: "student-1",
    studentName: "김민지",
    price: 12000,
    shippedAt: "2026-08-21",
    status: "payment-pending" as const,
  };

  it("교재 결제를 완료하면 판매 확정 기록과 수입 ledger를 만든다", () => {
    const result = completeBookSalePayment(pendingSale, {
      academyId: "academy-1",
      paidAt: "2026-08-22",
    });

    expect(result.sale).toEqual({
      ...pendingSale,
      status: "paid",
      paidAt: "2026-08-22",
      permanent: true,
    });
    expect(result.ledgerEntry).toEqual({
      academyId: "academy-1",
      ledgerId: "book-sale:sale-1",
      occurredOn: "2026-08-22",
      type: "income",
      source: "book-sale",
      amount: 12000,
      description: "교재 판매: 바이엘 2 / 김민지",
      refId: "sale-1",
    });
  });

  it("이미 결제 완료된 판매를 다시 완료 처리하지 않는다", () => {
    expect(() =>
      completeBookSalePayment(
        {
          ...pendingSale,
          status: "paid",
          paidAt: "2026-08-22",
          permanent: true,
        },
        {
          academyId: "academy-1",
          paidAt: "2026-08-23",
        },
      ),
    ).toThrow("이미 결제 완료된 교재 판매입니다.");
  });
});
