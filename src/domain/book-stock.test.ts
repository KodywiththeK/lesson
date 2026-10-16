import { describe, expect, it } from "vitest";

import {
  BOOK_MESSAGES,
  buildBookStockList,
  calculateBookAmount,
  calculateRestockPreview,
  findBookByTitle,
  normalizeBookTitle,
  validateBookReleaseInput,
  validateBookStockInput,
  validatePaymentDate,
  type BookStockRow,
} from "./book-stock";

const TODAY = "2026-10-17";

const books: BookStockRow[] = [
  { academyId: "academy-1", bookId: "book-2", title: "체르니 100", price: 15000, quantity: 0, stockedOn: "2026-09-01" },
  { academyId: "academy-1", bookId: "book-1", title: "바이엘 상", price: 12000, quantity: 10, stockedOn: "2026-10-01" },
  { academyId: "academy-2", bookId: "book-9", title: "다른 학원 교재", price: 9000, quantity: 3, stockedOn: "2026-10-01" },
];

describe("normalizeBookTitle / findBookByTitle", () => {
  it("탭·줄바꿈이 앞뒤에 붙어도 서버(SQL)와 같게 한 칸 공백 기준으로 정규화한다", () => {
    expect(normalizeBookTitle("\t바이엘\n상 ")).toBe("바이엘 상");
  });

  it("앞뒤 공백을 지우고 연속 공백을 한 칸으로 줄이며 대소문자를 구분하지 않는다", () => {
    expect(normalizeBookTitle("  Suzuki   Violin  1 ")).toBe("suzuki violin 1");
    expect(normalizeBookTitle("바이엘  상")).toBe(normalizeBookTitle("바이엘 상"));
  });

  it("같은 학원에서 정규화한 도서명이 같은 교재를 찾는다", () => {
    expect(findBookByTitle(books, "academy-1", " 바이엘   상 ")?.bookId).toBe("book-1");
    expect(findBookByTitle(books, "academy-1", "다른 학원 교재")).toBeUndefined();
  });

  it("수정 중인 교재 자신은 중복으로 보지 않는다", () => {
    expect(findBookByTitle(books, "academy-1", "바이엘 상", { exceptBookId: "book-1" })).toBeUndefined();
  });
});

describe("buildBookStockList", () => {
  it("현재 학원 교재를 도서명 가나다 오름차순으로 보여 주고 0권도 남긴다", () => {
    const view = buildBookStockList(books, { academyId: "academy-1" });

    expect(view.items.map((row) => row.title)).toEqual(["바이엘 상", "체르니 100"]);
    expect(view.items.find((row) => row.title === "체르니 100")).toMatchObject({
      quantity: 0,
      isOutOfStock: true,
    });
    expect(view.items.find((row) => row.title === "바이엘 상")?.isOutOfStock).toBe(false);
  });

  it("내림차순으로 바꾸면 도서명 방향만 뒤집힌다", () => {
    const view = buildBookStockList(books, { academyId: "academy-1", sortOrder: "desc" });

    expect(view.items.map((row) => row.title)).toEqual(["체르니 100", "바이엘 상"]);
  });

  it("도서명으로 검색한다", () => {
    const view = buildBookStockList(books, { academyId: "academy-1", search: "체르니" });

    expect(view.items.map((row) => row.bookId)).toEqual(["book-2"]);
  });

  it("같은 도서명이면 id로 순서를 고정한다", () => {
    const sameTitle: BookStockRow[] = [
      { academyId: "academy-1", bookId: "b", title: "같은 이름", price: 1, quantity: 1, stockedOn: TODAY },
      { academyId: "academy-1", bookId: "a", title: "같은 이름", price: 1, quantity: 1, stockedOn: TODAY },
    ];

    expect(buildBookStockList(sameTitle, { academyId: "academy-1" }).items.map((row) => row.bookId)).toEqual(["a", "b"]);
  });
});

describe("calculateBookAmount", () => {
  it("금액은 단가 × 수량이다", () => {
    expect(calculateBookAmount(15000, 3)).toBe(45000);
  });
});

describe("validateBookStockInput", () => {
  const valid = { title: "바이엘 상", price: 12000, quantity: 10, stockedOn: "2026-10-01" };

  it("올바른 입력이면 오류가 없다", () => {
    expect(validateBookStockInput(valid, TODAY)).toBeNull();
    expect(validateBookStockInput({ ...valid, quantity: 0 }, TODAY)).toBeNull();
  });

  it.each([
    [{ title: "   " }, BOOK_MESSAGES.titleRequired],
    [{ title: "가".repeat(101) }, BOOK_MESSAGES.titleTooLong],
    [{ price: 0 }, BOOK_MESSAGES.priceRange],
    [{ price: 10_000_000 }, BOOK_MESSAGES.priceRange],
    [{ price: 1500.5 }, BOOK_MESSAGES.priceRange],
    [{ quantity: -1 }, BOOK_MESSAGES.stockQuantityRange],
    [{ quantity: 10_000 }, BOOK_MESSAGES.stockQuantityRange],
    [{ stockedOn: "2026-10-18" }, BOOK_MESSAGES.futureStockedOn],
    [{ stockedOn: "" }, BOOK_MESSAGES.stockedOnRequired],
  ])("%j 이면 안내 문구를 돌려준다", (patch, message) => {
    expect(validateBookStockInput({ ...valid, ...patch }, TODAY)).toBe(message);
  });
});

describe("calculateRestockPreview", () => {
  it("같은 도서명 재입고는 권수를 합산하고 가격이 다르면 바뀐다고 알린다", () => {
    const preview = calculateRestockPreview(books, "academy-1", { title: " 바이엘  상", price: 13000, quantity: 5 });

    expect(preview).toEqual({
      existingBookId: "book-1",
      mergedQuantity: 15,
      priceChange: { from: 12000, to: 13000 },
      overflows: false,
    });
  });

  it("가격이 같으면 가격 변경은 없고 합계가 9,999권을 넘으면 알린다", () => {
    const preview = calculateRestockPreview(books, "academy-1", { title: "바이엘 상", price: 12000, quantity: 9995 });

    expect(preview?.priceChange).toBeNull();
    expect(preview?.overflows).toBe(true);
  });

  it("새 도서명이면 합산 대상이 없다", () => {
    expect(calculateRestockPreview(books, "academy-1", { title: "새 교재", price: 1000, quantity: 1 })).toBeNull();
  });
});

describe("validateBookReleaseInput", () => {
  const valid = {
    studentId: "student-1",
    bookId: "book-1",
    price: 12000,
    quantity: 2,
    shippedOn: "2026-10-17",
  };

  it("올바른 입력이면 오류가 없다", () => {
    expect(validateBookReleaseInput(valid, { today: TODAY, availableQuantity: 10 })).toBeNull();
  });

  it("재고보다 많이 출고하면 남은 재고를 알려 주고, 0권이면 입고 안내를 한다", () => {
    expect(validateBookReleaseInput({ ...valid, quantity: 3 }, { today: TODAY, availableQuantity: 2 })).toBe(
      BOOK_MESSAGES.insufficientStock(2),
    );
    expect(validateBookReleaseInput(valid, { today: TODAY, availableQuantity: 0 })).toBe(BOOK_MESSAGES.outOfStock);
  });

  it("단가 × 수량이 입출입내역 금액 한도(21억)를 넘으면 안내한다", () => {
    expect(
      validateBookReleaseInput({ ...valid, price: 3_000_000, quantity: 800 }, { today: TODAY, availableQuantity: 999 }),
    ).toBe(BOOK_MESSAGES.amountTooLarge);
    expect(
      validateBookReleaseInput({ ...valid, price: 2_000_000, quantity: 1000 - 1 }, { today: TODAY, availableQuantity: 999 }),
    ).toBeNull();
  });

  it.each([
    [{ studentId: "" }, BOOK_MESSAGES.studentRequired],
    [{ bookId: "" }, BOOK_MESSAGES.bookRequired],
    [{ price: 0 }, BOOK_MESSAGES.priceRange],
    [{ quantity: 0 }, BOOK_MESSAGES.releaseQuantityRange],
    [{ quantity: 1000 }, BOOK_MESSAGES.releaseQuantityRange],
    [{ shippedOn: "2026-10-18" }, BOOK_MESSAGES.futureShippedOn],
  ])("%j 이면 안내 문구를 돌려준다", (patch, message) => {
    expect(validateBookReleaseInput({ ...valid, ...patch }, { today: TODAY, availableQuantity: 100 })).toBe(message);
  });
});

describe("validatePaymentDate", () => {
  it("입금일은 출고일 이후여야 하고 미래도 허용한다", () => {
    expect(validatePaymentDate("2026-10-17", "2026-10-17")).toBeNull();
    expect(validatePaymentDate("2026-12-31", "2026-10-17")).toBeNull();
    expect(validatePaymentDate("2026-10-16", "2026-10-17")).toBe(BOOK_MESSAGES.paymentBeforeShipment("2026-10-17"));
    expect(validatePaymentDate("", "2026-10-17")).toBe(BOOK_MESSAGES.paidOnRequired);
  });
});
