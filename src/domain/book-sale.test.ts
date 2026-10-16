import { describe, expect, it } from "vitest";

import {
  type BookSale,
  buildBookPurchaseList,
} from "./book-sale";

describe("buildBookPurchaseList", () => {
  it("교재 구매 목록은 원생, 교재명, 자동 입력 가격, 출고일을 표시한다", () => {
    const rows = buildBookPurchaseList(
      [
        {
          academyId: "academy-1",
          saleId: "sale-2",
          bookId: "book-2",
          bookTitle: "체르니 100",
          studentId: "student-2",
          studentName: "이서윤",
          price: 15000,
          shippedAt: "2026-08-22",
          status: "payment-pending",
        },
        {
          academyId: "academy-1",
          saleId: "sale-1",
          bookId: "book-1",
          bookTitle: "바이엘 2",
          studentId: "student-1",
          studentName: "김민지",
          price: 12000,
          shippedAt: "2026-08-21",
          status: "payment-pending",
        },
        {
          academyId: "academy-2",
          saleId: "sale-3",
          bookId: "book-3",
          bookTitle: "다른 학원 교재",
          studentId: "student-3",
          studentName: "박하준",
          price: 10000,
          shippedAt: "2026-08-21",
          status: "payment-pending",
        },
      ],
      {
        academyId: "academy-1",
      },
    );

    expect(rows.items).toEqual([
      {
        saleId: "sale-1",
        studentName: "김민지",
        bookTitle: "바이엘 2",
        autoFilledPrice: 12000,
        shippedAt: "2026-08-21",
        status: "payment-pending",
      },
      {
        saleId: "sale-2",
        studentName: "이서윤",
        bookTitle: "체르니 100",
        autoFilledPrice: 15000,
        shippedAt: "2026-08-22",
        status: "payment-pending",
      },
    ]);
  });

  it("교재 구매 목록은 검색어와 결제 상태 필터를 적용한다", () => {
    const rows = buildBookPurchaseList(
      [
        {
          academyId: "academy-1",
          saleId: "sale-1",
          bookId: "book-1",
          bookTitle: "바이엘 2",
          studentId: "student-1",
          studentName: "김민지",
          price: 12000,
          shippedAt: "2026-08-21",
          status: "payment-pending",
        },
        {
          academyId: "academy-1",
          saleId: "sale-2",
          bookId: "book-2",
          bookTitle: "체르니 100",
          studentId: "student-2",
          studentName: "이서윤",
          price: 15000,
          shippedAt: "2026-08-22",
          status: "paid",
          paidAt: "2026-08-23",
          permanent: true,
        },
      ],
      {
        academyId: "academy-1",
        search: "체르니",
        filters: {
          status: "paid",
        },
      },
    );

    expect(rows.items).toEqual([
      {
        saleId: "sale-2",
        studentName: "이서윤",
        bookTitle: "체르니 100",
        autoFilledPrice: 15000,
        shippedAt: "2026-08-22",
        status: "paid",
      },
    ]);
    expect(rows.totalItems).toBe(1);
  });

  describe("페이지 나누기와 정렬", () => {
    function createSale(overrides: Partial<BookSale> = {}): BookSale {
      return {
        academyId: "academy-1",
        saleId: "sale-1",
        bookId: "book-1",
        bookTitle: "바이엘 2",
        studentId: "student-1",
        studentName: "김민지",
        price: 12000,
        shippedAt: "2026-08-21",
        status: "payment-pending",
        ...overrides,
      } as BookSale;
    }

    function createNumberedSales(count: number) {
      return Array.from({ length: count }, (_, index) => {
        const number = String(index + 1).padStart(2, "0");

        return createSale({
          saleId: `sale-${number}`,
          studentId: `student-${number}`,
          studentName: `원생${number}`,
          bookTitle: `교재${number}`,
        });
      });
    }

    it("기본은 10개씩 나누고 총 건수와 페이지 정보를 함께 준다", () => {
      const sales = createNumberedSales(25);

      const firstPage = buildBookPurchaseList(sales, { academyId: "academy-1" });
      const lastPage = buildBookPurchaseList(sales, { academyId: "academy-1", page: 3 });

      expect(firstPage.items).toHaveLength(10);
      expect(firstPage.items[0].studentName).toBe("원생01");
      expect(firstPage).toMatchObject({
        page: 1,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
        hasNextPage: true,
      });
      expect(lastPage.items.map((row) => row.studentName)).toEqual([
        "원생21",
        "원생22",
        "원생23",
        "원생24",
        "원생25",
      ]);
    });

    it("페이지당 20개를 고르면 20개씩 나눈다", () => {
      const view = buildBookPurchaseList(createNumberedSales(25), {
        academyId: "academy-1",
        page: 2,
        pageSize: 20,
      });

      expect(view.items).toHaveLength(5);
      expect(view).toMatchObject({ page: 2, pageSize: 20, totalPages: 2 });
    });

    it("출고일이 늦어도 원생명 가나다순을 먼저 따르고, 같은 원생이면 출고일, 교재명 순으로 정렬한다", () => {
      const view = buildBookPurchaseList(
        [
          createSale({ saleId: "sale-1", studentName: "이서윤", shippedAt: "2026-08-01" }),
          createSale({ saleId: "sale-2", studentName: "김민지", shippedAt: "2026-08-22", bookTitle: "체르니 100" }),
          createSale({ saleId: "sale-3", studentName: "김민지", shippedAt: "2026-08-22", bookTitle: "바이엘 2" }),
          createSale({ saleId: "sale-4", studentName: "김민지", shippedAt: "2026-08-10", bookTitle: "하농" }),
          createSale({ saleId: "sale-5", studentName: "김민지", shippedAt: "2026-08-22", bookTitle: "바이엘 2 상" }),
        ],
        { academyId: "academy-1" },
      );

      expect(view.items.map((row) => row.saleId)).toEqual(["sale-4", "sale-3", "sale-5", "sale-2", "sale-1"]);
    });

    it("원생명, 교재명, 출고일, 결제 상태 이름으로 검색한다", () => {
      const sales = [
        createSale({ saleId: "sale-1", studentName: "김민지", bookTitle: "바이엘 2", shippedAt: "2026-08-21" }),
        createSale({
          saleId: "sale-2",
          studentName: "이서윤",
          bookTitle: "체르니 100",
          shippedAt: "2026-09-02",
          status: "paid",
          paidAt: "2026-09-03",
          permanent: true,
        }),
      ];
      const search = (keyword: string) =>
        buildBookPurchaseList(sales, { academyId: "academy-1", search: keyword }).items.map((row) => row.saleId);

      expect(search("이서")).toEqual(["sale-2"]);
      expect(search("바이엘")).toEqual(["sale-1"]);
      expect(search("2026-09")).toEqual(["sale-2"]);
      expect(search("결제 대기")).toEqual(["sale-1"]);
      expect(search("  김민지  ")).toEqual(["sale-1"]);
    });

    it("원생명은 숫자 크기와 가나다 기준으로 정렬한다", () => {
      const view = buildBookPurchaseList(
        ["원생10", "원생2", "하늘", "가은"].map((studentName, index) =>
          createSale({ saleId: `sale-${index}`, studentName }),
        ),
        { academyId: "academy-1" },
      );

      expect(view.items.map((row) => row.studentName)).toEqual(["가은", "원생2", "원생10", "하늘"]);
    });

    it("원생·출고일·교재명이 모두 같아도 페이지를 넘길 때 중복이나 누락이 없다", () => {
      const sameSales = Array.from({ length: 12 }, (_, index) =>
        createSale({ saleId: `sale-${index + 1}` }),
      );

      const firstPage = buildBookPurchaseList(sameSales, { academyId: "academy-1" });
      const secondPage = buildBookPurchaseList(sameSales, { academyId: "academy-1", page: 2 });
      const pagedIds = [...firstPage.items, ...secondPage.items].map((row) => row.saleId);

      expect(pagedIds).toEqual(Array.from({ length: 12 }, (_, index) => `sale-${index + 1}`));
    });

    it("검색과 결제 상태 필터를 적용한 결과를 기준으로 총 건수를 센다", () => {
      const sales = [
        ...createNumberedSales(12),
        createSale({
          saleId: "sale-paid",
          studentName: "한서아",
          bookTitle: "체르니 100",
          status: "paid",
          paidAt: "2026-08-23",
          permanent: true,
        }),
      ];

      expect(buildBookPurchaseList(sales, { academyId: "academy-1", search: "교재" }).totalItems).toBe(12);
      expect(
        buildBookPurchaseList(sales, { academyId: "academy-1", filters: { status: "paid" } }).totalItems,
      ).toBe(1);
    });
  });
});
