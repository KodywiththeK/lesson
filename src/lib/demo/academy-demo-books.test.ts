import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelDemoBookPayment,
  completeDemoBookRelease,
  deleteDemoBook,
  deleteDemoBookRelease,
  registerDemoBookRelease,
  registerDemoBookStock,
  updateDemoBook,
  updateDemoBookRelease,
} from "./academy-demo-books";
import { createInitialDemoAcademyState, type DemoAcademyState } from "./academy-demo-state";

function stockOf(state: DemoAcademyState, bookId: string) {
  return state.books.find((book) => book.bookId === bookId)?.quantity;
}

function release(state: DemoAcademyState, overrides = {}) {
  return registerDemoBookRelease(state, {
    studentId: "student-1",
    bookId: "book-1",
    price: 12000,
    quantity: 2,
    shippedOn: "2026-10-10",
    status: "payment-pending",
    ...overrides,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T03:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("교재 등록·재입고·수정·삭제", () => {
  it("새 도서명은 새 교재가 되고 같은 도서명(공백·대소문자만 다름)은 권수를 합산하며 입고일·가격을 갱신한다", () => {
    const state = createInitialDemoAcademyState();

    const added = registerDemoBookStock(state, { title: "하농 1", price: 10000, quantity: 5, stockedOn: "2026-10-17" });
    expect(added.books.find((book) => book.title === "하농 1")).toMatchObject({ quantity: 5, active: true });

    const restocked = registerDemoBookStock(added, {
      title: "  바이엘   상 ",
      price: 13000,
      quantity: 5,
      stockedOn: "2026-10-16",
    });
    expect(restocked.books.filter((book) => book.title === "바이엘 상")).toEqual([
      expect.objectContaining({ bookId: "book-1", quantity: 14, price: 13000, stockedOn: "2026-10-16" }),
    ]);
  });

  it("구입 거래처는 새 교재에 저장하고, 재입고는 입력하면 덮어쓰고 비우면 기존 값을 유지한다", () => {
    const state = createInitialDemoAcademyState();
    const base = { price: 10000, quantity: 1, stockedOn: "2026-10-17" };

    const added = registerDemoBookStock(state, { ...base, title: "하농 1", purchaseVendorName: "예음문구" });
    const keptOnBlank = registerDemoBookStock(added, { ...base, title: "하농 1" });
    const overwritten = registerDemoBookStock(keptOnBlank, { ...base, title: "하농 1", purchaseVendorName: "악기마을" });

    const vendorOf = (target: typeof state) => target.books.find((book) => book.title === "하농 1")?.purchaseVendorName;
    expect(vendorOf(added)).toBe("예음문구");
    expect(vendorOf(keptOnBlank)).toBe("예음문구");
    expect(vendorOf(overwritten)).toBe("악기마을");
  });

  it("교재 수정은 구입 거래처를 입력한 그대로 저장하고 비우면 지운다", () => {
    const state = createInitialDemoAcademyState();
    const input = { bookId: "book-1", title: "바이엘 상", price: 12000, quantity: 9, stockedOn: "2026-08-01" };

    const named = updateDemoBook(state, { ...input, purchaseVendorName: "예음문구" });
    const cleared = updateDemoBook(named, input);

    expect(named.books.find((book) => book.bookId === "book-1")?.purchaseVendorName).toBe("예음문구");
    expect(cleared.books.find((book) => book.bookId === "book-1")?.purchaseVendorName).toBeUndefined();
  });

  it("입력 범위를 넘거나 합계가 9,999권을 넘으면 안내 문구로 거부한다", () => {
    const state = createInitialDemoAcademyState();

    expect(() =>
      registerDemoBookStock(state, { title: "", price: 1000, quantity: 1, stockedOn: "2026-10-17" }),
    ).toThrow("도서명을 입력해 주세요.");
    expect(() =>
      registerDemoBookStock(state, { title: "새 교재", price: 1000, quantity: 1, stockedOn: "2026-10-18" }),
    ).toThrow("입고일은 오늘 이후로 정할 수 없습니다.");
    expect(() =>
      registerDemoBookStock(state, { title: "바이엘 상", price: 12000, quantity: 9995, stockedOn: "2026-10-17" }),
    ).toThrow("재고는 9,999권을 넘을 수 없습니다.");
  });

  it("교재 수정은 권수를 직접 고치고 다른 교재와 같은 도서명이 되면 거부한다", () => {
    const state = createInitialDemoAcademyState();

    const updated = updateDemoBook(state, {
      bookId: "book-1",
      title: "바이엘 상(개정)",
      price: 12500,
      quantity: 3,
      stockedOn: "2026-10-01",
    });
    expect(updated.books.find((book) => book.bookId === "book-1")).toMatchObject({ title: "바이엘 상(개정)", quantity: 3 });

    expect(() =>
      updateDemoBook(state, { bookId: "book-1", title: "체르니 100", price: 1, quantity: 1, stockedOn: "2026-10-01" }),
    ).toThrow("이미 등록된 도서명입니다. 같은 이름의 교재의 권수를 수정해 주세요.");
  });

  it("교재 삭제는 보관 처리라 판매 기록은 남고 같은 도서명으로 새로 등록할 수 있다", () => {
    const state = createInitialDemoAcademyState();

    const deleted = deleteDemoBook(state, { bookId: "book-1" });

    expect(deleted.books.find((book) => book.bookId === "book-1")?.active).toBe(false);
    expect(deleted.bookSales.find((sale) => sale.saleId === "book-sale-1")).toMatchObject({ bookTitle: "바이엘 상" });

    const reregistered = registerDemoBookStock(deleted, {
      title: "바이엘 상",
      price: 12000,
      quantity: 4,
      stockedOn: "2026-10-17",
    });
    expect(reregistered.books.filter((book) => book.title === "바이엘 상" && book.active)).toHaveLength(1);
    expect(() => deleteDemoBook(deleted, { bookId: "book-1" })).toThrow("이미 삭제되었거나 찾을 수 없습니다.");
  });
});

describe("출고 등록", () => {
  it("재고를 수량만큼 줄이고 결제 대기 출고를 만들며 단가는 입력한 값을 저장한다", () => {
    const state = createInitialDemoAcademyState();
    const before = stockOf(state, "book-1") ?? 0;

    const next = release(state, { price: 10000, quantity: 3 });

    expect(stockOf(next, "book-1")).toBe(before - 3);
    expect(next.bookSales.at(-1)).toMatchObject({
      status: "payment-pending",
      studentName: "김민지",
      bookTitle: "바이엘 상",
      price: 10000,
      quantity: 3,
    });
    // 교재 가격은 바뀌지 않는다.
    expect(next.books.find((book) => book.bookId === "book-1")?.price).toBe(12000);
  });

  it("재고보다 많이 출고하면 남은 재고를 알리고 0권이면 입고 안내를 한다", () => {
    const state = createInitialDemoAcademyState();

    expect(() => release(state, { quantity: 99 })).toThrow(
      `재고가 부족합니다. 남은 재고는 ${stockOf(state, "book-1")}권입니다.`,
    );
    expect(() => release(state, { bookId: "book-3", quantity: 1 })).toThrow(
      "재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.",
    );
  });

  it("재원 중이 아닌 원생과 보관한 교재, 미래 출고일은 거부한다", () => {
    const state = createInitialDemoAcademyState();

    expect(() => release(state, { studentId: "none" })).toThrow("재원 중인 원생을 선택해 주세요.");
    expect(() => release(deleteDemoBook(state, { bookId: "book-1" }))).toThrow("교재를 찾을 수 없습니다.");
    expect(() => release(state, { shippedOn: "2026-10-18" })).toThrow("출고일은 오늘 이후로 정할 수 없습니다.");
  });

  it("바로 결제 완료는 입금일(기본 출고일)로 입출입내역 수입 행을 만든다(금액 = 단가 × 수량)", () => {
    const state = createInitialDemoAcademyState();

    const next = release(state, { status: "paid", quantity: 3, price: 15000 });

    const sale = next.bookSales.at(-1);
    expect(sale).toMatchObject({ status: "paid", paidAt: "2026-10-10" });
    expect(next.ledgerEntries).toContainEqual(
      expect.objectContaining({
        type: "income",
        source: "book-sale",
        occurredOn: "2026-10-10",
        amount: 45000,
        description: "교재 판매: 바이엘 상 × 3권 / 김민지",
        refId: sale?.saleId,
      }),
    );
  });
});

describe("출고 수정·삭제", () => {
  it("도서를 바꾸면 이전 도서 재고를 복원하고 새 도서 재고를 차감한다", () => {
    const base = release(createInitialDemoAcademyState());
    const saleId = base.bookSales.at(-1)?.saleId ?? "";
    const book1Before = stockOf(base, "book-1") ?? 0;
    const book2Before = stockOf(base, "book-2") ?? 0;

    const next = updateDemoBookRelease(base, {
      releaseId: saleId,
      studentId: "student-1",
      bookId: "book-2",
      price: 18000,
      quantity: 1,
      shippedOn: "2026-10-11",
    });

    expect(stockOf(next, "book-1")).toBe(book1Before + 2);
    expect(stockOf(next, "book-2")).toBe(book2Before - 1);
    expect(next.bookSales.find((sale) => sale.saleId === saleId)).toMatchObject({
      bookId: "book-2",
      bookTitle: "스즈키 바이올린 1",
      price: 18000,
      quantity: 1,
    });
  });

  it("새 도서 재고가 모자라면 아무것도 바뀌지 않는다", () => {
    const base = release(createInitialDemoAcademyState());
    const saleId = base.bookSales.at(-1)?.saleId ?? "";

    expect(() =>
      updateDemoBookRelease(base, {
        releaseId: saleId,
        studentId: "student-1",
        bookId: "book-3",
        price: 15000,
        quantity: 1,
        shippedOn: "2026-10-10",
      }),
    ).toThrow("재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.");
    expect(stockOf(base, "book-1")).toBe(7);
  });

  it("같은 도서에서 수량만 바꾸면 차이만큼 조정하고 늘릴 때 재고가 모자라면 거부한다", () => {
    const base = release(createInitialDemoAcademyState());
    const saleId = base.bookSales.at(-1)?.saleId ?? "";
    const input = { releaseId: saleId, studentId: "student-1", bookId: "book-1", price: 12000, shippedOn: "2026-10-10" };

    const more = updateDemoBookRelease(base, { ...input, quantity: 5 });
    expect(stockOf(more, "book-1")).toBe((stockOf(base, "book-1") ?? 0) - 3);
    expect(() => updateDemoBookRelease(base, { ...input, quantity: 100 })).toThrow("재고가 부족합니다.");
  });

  it("출고 삭제는 재고를 수량만큼 되돌리고 결제 완료 건은 수정·삭제할 수 없다", () => {
    const base = release(createInitialDemoAcademyState());
    const saleId = base.bookSales.at(-1)?.saleId ?? "";

    const deleted = deleteDemoBookRelease(base, { releaseId: saleId });
    expect(deleted.bookSales.some((sale) => sale.saleId === saleId)).toBe(false);
    expect(stockOf(deleted, "book-1")).toBe(9);

    const paid = completeDemoBookRelease(base, { releaseId: saleId, paidAt: "2026-10-12" });
    const message = "결제 완료된 출고는 수정하거나 삭제할 수 없습니다. 원장이 결제를 취소한 뒤 수정해 주세요.";
    expect(() => deleteDemoBookRelease(paid, { releaseId: saleId })).toThrow(message);
    expect(() =>
      updateDemoBookRelease(paid, {
        releaseId: saleId,
        studentId: "student-1",
        bookId: "book-1",
        price: 12000,
        quantity: 1,
        shippedOn: "2026-10-10",
      }),
    ).toThrow(message);
  });
});

describe("결제 처리와 결제 취소", () => {
  it("결제 처리는 입금일 ≥ 출고일이어야 하고 한 번만 수입 행을 만든다", () => {
    const base = release(createInitialDemoAcademyState(), { quantity: 3, price: 15000 });
    const saleId = base.bookSales.at(-1)?.saleId ?? "";

    expect(() => completeDemoBookRelease(base, { releaseId: saleId, paidAt: "2026-10-09" })).toThrow(
      "입금일은 출고일(2026-10-10) 이후여야 합니다.",
    );

    const paid = completeDemoBookRelease(base, { releaseId: saleId, paidAt: "2026-12-31" });
    expect(paid.bookSales.find((sale) => sale.saleId === saleId)).toMatchObject({ status: "paid", paidAt: "2026-12-31" });
    expect(paid.ledgerEntries.filter((entry) => entry.refId === saleId && entry.source === "book-sale")).toEqual([
      expect.objectContaining({ amount: 45000, occurredOn: "2026-12-31" }),
    ]);
    expect(() => completeDemoBookRelease(paid, { releaseId: saleId, paidAt: "2027-01-01" })).toThrow(
      "이미 결제 완료된 출고입니다.",
    );
  });

  it("없는 출고는 결제 처리할 수 없다", () => {
    expect(() =>
      completeDemoBookRelease(createInitialDemoAcademyState(), { releaseId: "none", paidAt: "2026-10-17" }),
    ).toThrow("이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.");
  });

  it("결제 취소는 사유가 필요하고 수입 행을 지우며 대기로 되돌리고 재고는 바꾸지 않는다", () => {
    const base = release(createInitialDemoAcademyState());
    const saleId = base.bookSales.at(-1)?.saleId ?? "";
    const paid = completeDemoBookRelease(base, { releaseId: saleId, paidAt: "2026-10-12" });

    expect(() => cancelDemoBookPayment(paid, { releaseId: saleId, reason: "  " })).toThrow("취소 사유를 입력해 주세요.");

    const cancelled = cancelDemoBookPayment(paid, { releaseId: saleId, reason: "입금 확인 착오" });
    expect(cancelled.bookSales.find((sale) => sale.saleId === saleId)).toMatchObject({ status: "payment-pending" });
    expect(cancelled.bookSales.find((sale) => sale.saleId === saleId)).not.toHaveProperty("paidAt");
    expect(cancelled.ledgerEntries.some((entry) => entry.refId === saleId && entry.source === "book-sale")).toBe(false);
    expect(stockOf(cancelled, "book-1")).toBe(stockOf(paid, "book-1"));
    expect(() => cancelDemoBookPayment(cancelled, { releaseId: saleId, reason: "다시" })).toThrow(
      "이미 결제 대기 상태입니다. 목록을 새로고침해 주세요.",
    );
  });

  it("입출입내역 행이 이미 지워진 결제 완료 건도 취소할 수 있다", () => {
    const base = release(createInitialDemoAcademyState(), { status: "paid" });
    const saleId = base.bookSales.at(-1)?.saleId ?? "";
    const withoutLedger = {
      ...base,
      ledgerEntries: base.ledgerEntries.filter((entry) => entry.refId !== saleId),
    };

    expect(cancelDemoBookPayment(withoutLedger, { releaseId: saleId, reason: "정정" }).bookSales.at(-1)).toMatchObject({
      status: "payment-pending",
    });
  });
});
