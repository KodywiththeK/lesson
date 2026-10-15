import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  buildListView,
  buildPageNumbers,
  compareKoreanNames,
  normalizePageSize,
  paginateItems,
} from "./common-list";

type StudentRow = {
  name: string;
  teacherName: string;
  instrumentName: string;
  weekday: string;
};

const students: StudentRow[] = [
  { name: "최민준", teacherName: "박선생", instrumentName: "피아노", weekday: "월" },
  { name: "김민지", teacherName: "박선생", instrumentName: "피아노", weekday: "수" },
  { name: "이서윤", teacherName: "이선생", instrumentName: "바이올린", weekday: "화" },
  { name: "강하은", teacherName: "최선생", instrumentName: "첼로", weekday: "금" },
  { name: "박하준", teacherName: "이선생", instrumentName: "피아노", weekday: "목" },
  { name: "오지우", teacherName: "박선생", instrumentName: "플루트", weekday: "토" },
  { name: "윤서아", teacherName: "이선생", instrumentName: "첼로", weekday: "월" },
  { name: "정도윤", teacherName: "최선생", instrumentName: "피아노", weekday: "수" },
  { name: "한지호", teacherName: "박선생", instrumentName: "바이올린", weekday: "금" },
  { name: "서유나", teacherName: "최선생", instrumentName: "플루트", weekday: "화" },
  { name: "배로이", teacherName: "이선생", instrumentName: "피아노", weekday: "목" },
];

describe("normalizePageSize", () => {
  it("공통 페이지 크기는 10, 20, 30만 허용한다", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 30]);
    expect(normalizePageSize(20)).toBe(20);
    expect(normalizePageSize(15)).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("buildListView", () => {
  it("목록은 기본 10개를 가나다순 이름 정렬로 보여준다", () => {
    const view = buildListView(students, {
      getName: (student) => student.name,
    });

    expect(view.pageSize).toBe(10);
    expect(view.items.map((student) => student.name)).toEqual([
      "강하은",
      "김민지",
      "박하준",
      "배로이",
      "서유나",
      "오지우",
      "윤서아",
      "이서윤",
      "정도윤",
      "최민준",
    ]);
    expect(view.totalItems).toBe(11);
    expect(view.totalPages).toBe(2);
  });

  it("이름 또는 지정 필드로 검색한다", () => {
    const view = buildListView(students, {
      getName: (student) => student.name,
      search: "피아노",
      searchFields: [
        (student) => student.name,
        (student) => student.instrumentName,
      ],
    });

    expect(view.items.map((student) => student.name)).toEqual([
      "김민지",
      "박하준",
      "배로이",
      "정도윤",
      "최민준",
    ]);
  });

  it("선생님, 악기, 요일 같은 필터를 함께 적용한다", () => {
    const view = buildListView(students, {
      getName: (student) => student.name,
      filters: {
        teacherName: "이선생",
        instrumentName: "피아노",
      },
      filterFields: {
        teacherName: (student) => student.teacherName,
        instrumentName: (student) => student.instrumentName,
        weekday: (student) => student.weekday,
      },
    });

    expect(view.items.map((student) => student.name)).toEqual(["박하준", "배로이"]);
  });

  it("페이지 번호와 페이지 크기로 결과를 나눈다", () => {
    const view = buildListView(students, {
      getName: (student) => student.name,
      page: 2,
      pageSize: 10,
    });

    expect(view.items.map((student) => student.name)).toEqual(["한지호"]);
    expect(view.page).toBe(2);
    expect(view.hasPreviousPage).toBe(true);
    expect(view.hasNextPage).toBe(false);
  });

  it("페이지 크기가 30이면 전체 결과를 한 페이지에 보여준다", () => {
    const view = buildListView(students, {
      getName: (student) => student.name,
      pageSize: 30,
    });

    expect(view.items).toHaveLength(11);
    expect(view.totalPages).toBe(1);
  });
});

describe("compareKoreanNames", () => {
  it("숫자는 숫자 크기로, 한글은 가나다순으로, 영문은 그 뒤에 정렬한다", () => {
    const names = ["Alice", "이서연", "10반", "가은", "7반", "각", "bob"];

    expect([...names].sort(compareKoreanNames)).toEqual(["7반", "10반", "가은", "각", "이서연", "Alice", "bob"]);
  });
});

describe("buildListView 동명이인 정렬", () => {
  it("이름이 같으면 보조 기준으로 순서를 고정해 페이지 경계에서 중복·누락이 없게 한다", () => {
    const rows = [
      { id: "c", name: "김민지" },
      { id: "a", name: "김민지" },
      { id: "b", name: "김민지" },
    ];
    const options = {
      getName: (row: (typeof rows)[number]) => row.name,
      getTieBreaker: (row: (typeof rows)[number]) => row.id,
      pageSize: 10,
    };

    expect(buildListView(rows, options).items.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(buildListView([...rows].reverse(), options).items.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("buildPageNumbers", () => {
  it("페이지가 적으면 모든 번호를 보여준다", () => {
    expect(buildPageNumbers(1, 1)).toEqual([1]);
    expect(buildPageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("페이지가 많으면 처음·끝·현재 주변만 보여주고 나머지는 생략한다", () => {
    expect(buildPageNumbers(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(buildPageNumbers(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(buildPageNumbers(10, 10)).toEqual([1, "ellipsis", 9, 10]);
    expect(buildPageNumbers(3, 10)).toEqual([1, 2, 3, 4, "ellipsis", 10]);
  });

  it("생략 부호가 한 페이지만 가리게 되면 그 번호를 그대로 보여준다", () => {
    expect(buildPageNumbers(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(buildPageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("paginateItems", () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);

  it("이미 정렬된 목록의 순서를 바꾸지 않고 해당 페이지만 자른다", () => {
    const view = paginateItems(items, { page: 3, pageSize: 10 });

    expect(view.items).toEqual([21, 22, 23, 24, 25]);
    expect(view).toMatchObject({ page: 3, pageSize: 10, totalItems: 25, totalPages: 3 });
    expect(view.hasPreviousPage).toBe(true);
    expect(view.hasNextPage).toBe(false);
  });

  it("범위를 벗어난 페이지는 가장 가까운 페이지로, 빈 목록은 1페이지로 맞춘다", () => {
    expect(paginateItems(items, { page: 99, pageSize: 10 }).page).toBe(3);
    expect(paginateItems(items, { page: 0, pageSize: 10 }).page).toBe(1);
    expect(paginateItems([], { page: 5, pageSize: 10 })).toMatchObject({
      items: [],
      page: 1,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
    });
  });

  it("허용되지 않은 페이지 크기는 기본 10개로 바꾼다", () => {
    expect(paginateItems(items, { page: 1, pageSize: 15 }).pageSize).toBe(10);
  });
});
