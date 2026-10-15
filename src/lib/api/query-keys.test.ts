import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it("학원별 원생 목록 key에 academyId와 필터를 포함한다", () => {
    expect(
      queryKeys.students.list("academy-1", {
        status: "active",
        q: "민",
        teacherName: "박선생",
        instrumentName: "피아노",
        weekdayLabel: "월",
      }),
    ).toEqual([
      "academy",
      "academy-1",
      "students",
      "list",
      "active",
      "민",
      "박선생",
      "피아노",
      "월",
      "",
      "",
    ]);
  });

  it("같은 기능이라도 academyId가 다르면 다른 cache key를 만든다", () => {
    expect(queryKeys.lessonTickets.summary("academy-1")).not.toEqual(
      queryKeys.lessonTickets.summary("academy-2"),
    );
  });

  it("학원별 선생님 목록 key에 academyId와 검색/필터를 포함한다", () => {
    expect(
      queryKeys.teachers.list("academy-1", {
        q: "박",
        part: "피아노",
        payType: "ratio",
        status: "employed",
      }),
    ).toEqual([
      "academy",
      "academy-1",
      "teachers",
      "list",
      "박",
      "피아노",
      "ratio",
      "employed",
    ]);
  });

  it("휴원/퇴원 관리 key에 대상 종류와 상태를 포함한다", () => {
    expect(
      queryKeys.statusManagement.list("academy-1", {
        entityType: "student",
        status: "withdrawn",
      }),
    ).toEqual([
      "academy",
      "academy-1",
      "status-management",
      "student",
      "withdrawn",
    ]);
  });

  it("학원별 거래처 목록 key에 academyId와 검색/필터를 포함한다", () => {
    expect(
      queryKeys.vendors.list("academy-1", {
        q: "문구",
        kind: "교재",
      }),
    ).toEqual([
      "academy",
      "academy-1",
      "vendors",
      "list",
      "문구",
      "교재",
    ]);
  });

  it("학원별 교재 구매 목록 key에 academyId와 검색/상태 필터를 포함한다", () => {
    expect(
      queryKeys.books.purchaseList("academy-1", {
        q: "바이엘",
        status: "payment-pending",
      }),
    ).toEqual([
      "academy",
      "academy-1",
      "books",
      "purchase-list",
      "바이엘",
      "payment-pending",
    ]);
  });

  it("학원별 입출입 내역 key에 academyId와 검색/유형/출처 필터를 포함한다", () => {
    expect(queryKeys.finance.all("academy-1")).toEqual(["academy", "academy-1", "finance"]);
    expect(
      queryKeys.finance.ledgerList("academy-1", {
        q: "조율",
        type: "expense",
        source: "manual",
        category: "tuning-repair",
        from: "2026-08-01",
        to: "2026-08-31",
        sort: "amount-desc",
      }),
    ).toEqual([
      "academy",
      "academy-1",
      "finance",
      "ledger-list",
      "조율",
      "expense",
      "manual",
      "tuning-repair",
      "2026-08-01",
      "2026-08-31",
      "amount-desc",
    ]);
  });

  it("학원별 회차권 목록 key에 academyId와 검색/상태 필터를 포함한다", () => {
    expect(
      queryKeys.lessonTickets.list("academy-1", {
        q: "피아노",
        status: "low-remaining",
      }),
    ).toEqual([
      "academy",
      "academy-1",
      "lesson-tickets",
      "list",
      "피아노",
      "low-remaining",
    ]);
  });

  it("회차권 등록 선택지 key를 학원별로 분리한다", () => {
    expect(queryKeys.lessonTickets.registrationOptions("academy-1")).toEqual([
      "academy",
      "academy-1",
      "lesson-tickets",
      "registration-options",
    ]);
  });

  it("개인레슨 등록 선택지 key를 학원별로 분리한다", () => {
    expect(queryKeys.privateLessons.registrationOptions("academy-1")).toEqual([
      "academy",
      "academy-1",
      "private-lessons",
      "registration-options",
    ]);
  });

  it("학원 수업 일별 출석 key를 학원과 날짜별로 분리한다", () => {
    expect(
      queryKeys.academyLessons.dailyAttendance("academy-1", "2026-08-21"),
    ).toEqual([
      "academy",
      "academy-1",
      "academy-lessons",
      "daily-attendance",
      "2026-08-21",
    ]);
  });
});
