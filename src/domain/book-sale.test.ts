import { describe, expect, it } from "vitest";

import {
  buildBookPaidList,
  buildBookShipmentList,
  formatBookSaleLedgerDescription,
  formatBookSaleStatus,
  type BookSale,
} from "./book-sale";

function createSale(overrides: Partial<BookSale> = {}): BookSale {
  return {
    academyId: "academy-1",
    saleId: "sale-1",
    bookId: "book-1",
    bookTitle: "바이엘 2",
    studentId: "student-1",
    studentName: "김민지",
    price: 12000,
    quantity: 1,
    shippedAt: "2026-08-21",
    status: "payment-pending",
    ...overrides,
  } as BookSale;
}

function createPaidSale(overrides: Partial<BookSale> = {}): BookSale {
  return createSale({
    status: "paid",
    paidAt: "2026-08-23",
    paidLedgerEntryId: "ledger-1",
    permanent: true,
    ...overrides,
  } as Partial<BookSale>);
}

describe("buildBookShipmentList", () => {
  it("결제 대기 출고만 현재 학원 범위에서 단가·수량·금액과 함께 보여 준다", () => {
    const view = buildBookShipmentList(
      [
        createSale({ saleId: "sale-1", price: 15000, quantity: 3 }),
        createSale({ saleId: "sale-2", academyId: "academy-2", studentName: "다른 학원" }),
        createPaidSale({ saleId: "sale-3" }),
      ],
      { academyId: "academy-1" },
    );

    expect(view.items).toEqual([
      {
        saleId: "sale-1",
        bookId: "book-1",
        studentId: "student-1",
        studentName: "김민지",
        bookTitle: "바이엘 2",
        price: 15000,
        quantity: 3,
        amount: 45000,
        shippedAt: "2026-08-21",
      },
    ]);
    expect(view.totalItems).toBe(1);
  });

  it("원생명 가나다순 → 출고일 → 교재명 → id 순으로 정렬한다", () => {
    const view = buildBookShipmentList(
      [
        createSale({ saleId: "sale-1", studentName: "이서윤", shippedAt: "2026-08-01" }),
        createSale({ saleId: "sale-2", studentName: "김민지", shippedAt: "2026-08-22", bookTitle: "체르니 100" }),
        createSale({ saleId: "sale-3", studentName: "김민지", shippedAt: "2026-08-22", bookTitle: "바이엘 2" }),
        createSale({ saleId: "sale-4", studentName: "김민지", shippedAt: "2026-08-10", bookTitle: "하농" }),
      ],
      { academyId: "academy-1" },
    );

    expect(view.items.map((row) => row.saleId)).toEqual(["sale-4", "sale-3", "sale-2", "sale-1"]);
  });

  it("원생명·도서명·출고일로 검색하고 10개씩 나눈다", () => {
    const sales = Array.from({ length: 25 }, (_, index) =>
      createSale({
        saleId: `sale-${String(index + 1).padStart(2, "0")}`,
        studentName: `원생${String(index + 1).padStart(2, "0")}`,
        bookTitle: index === 3 ? "체르니 100" : "바이엘",
      }),
    );

    expect(buildBookShipmentList(sales, { academyId: "academy-1", search: "체르니" }).items).toHaveLength(1);
    expect(buildBookShipmentList(sales, { academyId: "academy-1", search: "원생04" }).items[0].saleId).toBe("sale-04");
    expect(buildBookShipmentList(sales, { academyId: "academy-1" })).toMatchObject({
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
    });
    expect(buildBookShipmentList(sales, { academyId: "academy-1", page: 3 }).items).toHaveLength(5);
  });

  it("원생이 삭제되어 연결이 끊긴 출고도 이름 스냅샷으로 보여 준다", () => {
    const view = buildBookShipmentList(
      [createSale({ studentId: null, studentName: "삭제된원생" })],
      { academyId: "academy-1" },
    );

    expect(view.items[0]).toMatchObject({ studentId: null, studentName: "삭제된원생" });
  });
});

describe("buildBookPaidList", () => {
  it("결제 완료 건만 입금일이 속한 월 기준으로 보여 주고 금액은 단가 × 수량이다", () => {
    const view = buildBookPaidList(
      [
        createPaidSale({ saleId: "sale-1", shippedAt: "2026-07-28", paidAt: "2026-08-02", price: 15000, quantity: 2 }),
        createPaidSale({ saleId: "sale-2", shippedAt: "2026-08-28", paidAt: "2026-09-02" }),
        createSale({ saleId: "sale-3" }),
      ],
      { academyId: "academy-1", month: "2026-08" },
    );

    expect(view.items).toEqual([
      {
        saleId: "sale-1",
        studentName: "김민지",
        bookTitle: "바이엘 2",
        price: 15000,
        quantity: 2,
        amount: 30000,
        shippedAt: "2026-07-28",
        paidAt: "2026-08-02",
        ledgerMissing: false,
      },
    ]);
  });

  it("입출입내역 연결이 끊긴 결제 완료 건은 원장 기록 없음으로 표시한다", () => {
    const view = buildBookPaidList(
      [
        createPaidSale({ saleId: "sale-1", paidLedgerEntryId: null }),
        createPaidSale({ saleId: "sale-2", paidLedgerEntryId: undefined }),
      ],
      { academyId: "academy-1", month: "2026-08" },
    );

    expect(view.items.find((row) => row.saleId === "sale-1")?.ledgerMissing).toBe(true);
    // 연결 정보를 읽지 않은 환경(데모)은 알 수 없으므로 표시하지 않는다.
    expect(view.items.find((row) => row.saleId === "sale-2")?.ledgerMissing).toBe(false);
  });

  it("입금일 최신순 → 원생명 → 도서명 → id 순으로 정렬하고 이름·도서명으로 검색한다", () => {
    const sales = [
      createPaidSale({ saleId: "sale-1", studentName: "이서윤", paidAt: "2026-08-10" }),
      createPaidSale({ saleId: "sale-2", studentName: "김민지", paidAt: "2026-08-20", bookTitle: "체르니 100" }),
      createPaidSale({ saleId: "sale-3", studentName: "김민지", paidAt: "2026-08-20", bookTitle: "바이엘 2" }),
    ];

    expect(buildBookPaidList(sales, { academyId: "academy-1", month: "2026-08" }).items.map((row) => row.saleId)).toEqual([
      "sale-3",
      "sale-2",
      "sale-1",
    ]);
    expect(
      buildBookPaidList(sales, { academyId: "academy-1", month: "2026-08", search: "체르니" }).items.map((row) => row.saleId),
    ).toEqual(["sale-2"]);
  });
});

describe("formatBookSaleStatus", () => {
  it("상태를 사용자가 쓰는 말로 바꾼다", () => {
    expect(formatBookSaleStatus("paid")).toBe("결제 완료");
    expect(formatBookSaleStatus("payment-pending")).toBe("결제 대기");
  });
});

describe("formatBookSaleLedgerDescription", () => {
  it("수량이 1권이면 도서명과 원생만, 2권 이상이면 수량도 적는다(서버 입출입내역 설명과 같다)", () => {
    expect(
      formatBookSaleLedgerDescription({ bookTitle: "바이엘 2", quantity: 1, studentName: "김민지" }),
    ).toBe("교재 판매: 바이엘 2 / 김민지");
    expect(
      formatBookSaleLedgerDescription({ bookTitle: "바이엘 2", quantity: 3, studentName: "김민지" }),
    ).toBe("교재 판매: 바이엘 2 × 3권 / 김민지");
  });
});
