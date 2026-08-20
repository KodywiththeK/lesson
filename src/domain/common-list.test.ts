import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  buildListView,
  normalizePageSize,
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
