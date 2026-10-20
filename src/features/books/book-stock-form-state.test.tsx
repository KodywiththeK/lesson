import { describe, expect, it } from "vitest";

import { BOOK_MESSAGES, type BookStockRow } from "@/domain/book-stock";

import {
  didRestock,
  evaluateBookStockForm,
  toBookStockFormValues,
  type BookStockFormContext,
  type BookStockFormValues,
} from "./book-stock-form-state";

const bayer: BookStockRow = {
  academyId: "academy-1",
  bookId: "book-1",
  title: "바이엘 상",
  price: 12000,
  quantity: 9,
  stockedOn: "2026-08-01",
};
const suzuki: BookStockRow = {
  academyId: "academy-1",
  bookId: "book-2",
  title: "스즈키 바이올린 1",
  price: 18000,
  quantity: 4,
  stockedOn: "2026-08-03",
};

const context: BookStockFormContext = {
  academyId: "academy-1",
  books: [bayer, suzuki],
  today: "2026-10-17",
};

const validValues: BookStockFormValues = {
  title: "체르니 30",
  price: "14000",
  quantity: "5",
  stockedOn: "2026-10-17",
};

describe("evaluateBookStockForm", () => {
  it("모든 항목이 올바르면 막지 않고 숫자로 바꾼 입력을 돌려준다", () => {
    const state = evaluateBookStockForm({ ...validValues, title: "  체르니 30 " }, context);

    expect(state.blockReason).toBeNull();
    expect(state.restockNotice).toBeNull();
    expect(state.input).toEqual({ title: "체르니 30", price: 14000, quantity: 5, stockedOn: "2026-10-17" });
  });

  it("쉼표가 포함된 가격을 원 단위 정수로 해석한다", () => {
    const state = evaluateBookStockForm({ ...validValues, price: "140,000" }, context);

    expect(state.blockReason).toBeNull();
    expect(state.input.price).toBe(140000);
  });

  it("비워 둔 항목은 도메인 오류 문구로 막는다. 권수를 비워도 0권으로 보지 않는다", () => {
    expect(evaluateBookStockForm({ ...validValues, title: " " }, context).blockReason).toBe(
      BOOK_MESSAGES.titleRequired,
    );
    expect(evaluateBookStockForm({ ...validValues, price: "" }, context).blockReason).toBe(
      BOOK_MESSAGES.priceRange,
    );
    expect(evaluateBookStockForm({ ...validValues, quantity: "" }, context).blockReason).toBe(
      BOOK_MESSAGES.stockQuantityRange,
    );
    expect(evaluateBookStockForm({ ...validValues, quantity: "0" }, context).blockReason).toBeNull();
  });

  it("범위를 벗어나거나 정수가 아닌 값과 미래 입고일은 막는다", () => {
    expect(evaluateBookStockForm({ ...validValues, price: "1.5" }, context).blockReason).toBe(
      BOOK_MESSAGES.priceRange,
    );
    expect(evaluateBookStockForm({ ...validValues, quantity: "10000" }, context).blockReason).toBe(
      BOOK_MESSAGES.stockQuantityRange,
    );
    expect(evaluateBookStockForm({ ...validValues, stockedOn: "2026-10-18" }, context).blockReason).toBe(
      BOOK_MESSAGES.futureStockedOn,
    );
  });

  describe("등록(재입고 미리보기)", () => {
    it("같은 도서명이면 합산 권수와 바뀌는 가격을 미리 안내하고 등록은 막지 않는다", () => {
      const state = evaluateBookStockForm(
        { ...validValues, title: "  바이엘   상 ", price: "13000", quantity: "5" },
        context,
      );

      expect(state.blockReason).toBeNull();
      expect(state.restockNotice).toBe(
        "이미 등록된 교재입니다. 권수가 합산되고(현재 9권 → 14권) 가격이 12,000원에서 13,000원으로 바뀝니다.",
      );
    });

    it("가격이 같으면 가격 문구를 생략한다", () => {
      const state = evaluateBookStockForm({ ...validValues, title: "바이엘 상", price: "12000" }, context);

      expect(state.restockNotice).toBe("이미 등록된 교재입니다. 권수가 합산됩니다(현재 9권 → 14권).");
    });

    it("가격을 아직 입력하지 않았으면 가격 문구 없이 합산만 안내한다", () => {
      const state = evaluateBookStockForm({ ...validValues, title: "바이엘 상", price: "" }, context);

      expect(state.restockNotice).toBe("이미 등록된 교재입니다. 권수가 합산됩니다(현재 9권 → 14권).");
    });

    it("합계가 9,999권을 넘으면 안내와 함께 막고 줄이는 방법을 알린다", () => {
      const state = evaluateBookStockForm(
        { ...validValues, title: "바이엘 상", price: "12000", quantity: "9991" },
        context,
      );

      expect(state.restockNotice).toContain("현재 9권 → 10,000권");
      expect(state.blockReason).toBe(`${BOOK_MESSAGES.stockOverflow} 입력한 권수를 줄여 주세요.`);
    });
  });

  describe("수정", () => {
    const editContext: BookStockFormContext = { ...context, editingBookId: "book-1" };

    it("자기 자신의 도서명을 그대로 두면 중복이 아니고 재입고 안내도 없다", () => {
      const state = evaluateBookStockForm(toBookStockFormValues(bayer), editContext);

      expect(state.blockReason).toBeNull();
      expect(state.restockNotice).toBeNull();
      expect(state.input).toEqual({ title: "바이엘 상", price: 12000, quantity: 9, stockedOn: "2026-08-01" });
    });

    it("다른 교재와 같은 도서명이 되면 권수를 수정하라는 문구로 막는다", () => {
      const state = evaluateBookStockForm(
        { ...toBookStockFormValues(bayer), title: " 스즈키 바이올린 1" },
        editContext,
      );

      expect(state.blockReason).toBe(BOOK_MESSAGES.duplicateTitle);
      expect(state.restockNotice).toBeNull();
    });

    it("현재 재고를 0권으로 고칠 수 있다", () => {
      const state = evaluateBookStockForm({ ...toBookStockFormValues(bayer), quantity: "0" }, editContext);

      expect(state.blockReason).toBeNull();
    });
  });
});

describe("didRestock", () => {
  const input = { title: "바이엘 상", price: 12000, quantity: 5, stockedOn: "2026-10-17" };

  it("저장 전 목록에 같은 도서명이 있었으면 합산으로 본다", () => {
    expect(didRestock(context.books, "academy-1", input, undefined)).toBe(true);
  });

  it("목록이 낡았어도 서버가 돌려준 권수가 입력과 다르면 합산으로 본다", () => {
    expect(didRestock([], "academy-1", input, { ...bayer, quantity: 14 })).toBe(true);
  });

  it("새 도서명이고 서버 권수가 입력과 같으면 새 교재로 본다", () => {
    expect(didRestock([suzuki], "academy-1", input, { ...bayer, quantity: 5 })).toBe(false);
    expect(didRestock([suzuki], "academy-1", input, undefined)).toBe(false);
  });
});
