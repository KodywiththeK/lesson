import { describe, expect, it } from "vitest";

import { buildVendorList } from "./vendor-list";

const vendors = [
  {
    academyId: "academy-1",
    vendorId: "vendor-1",
    name: "예음문구",
    contact: "02-111-1111",
    kind: "교재",
    memo: "바이엘 재고 확인",
  },
  {
    academyId: "academy-1",
    vendorId: "vendor-2",
    name: "스튜디오조율",
    contact: "02-222-2222",
    kind: "피아노 조율",
    memo: "분기 조율",
  },
  {
    academyId: "academy-2",
    vendorId: "vendor-3",
    name: "다른문구",
    contact: "02-333-3333",
    kind: "교재",
    memo: "",
  },
];

describe("buildVendorList", () => {
  it("학원 범위 안에서 거래처 목록을 가나다순으로 만든다", () => {
    const result = buildVendorList(vendors, {
      academyId: "academy-1",
    });

    expect(result.items.map((vendor) => vendor.name)).toEqual([
      "스튜디오조율",
      "예음문구",
    ]);
    expect(result.totalItems).toBe(2);
  });

  it("거래처명, 연락처, 종류, 비고 기준 검색을 지원한다", () => {
    const result = buildVendorList(vendors, {
      academyId: "academy-1",
      search: "바이엘",
    });

    expect(result.items.map((vendor) => vendor.name)).toEqual(["예음문구"]);
  });

  it("거래처 종류 필터를 적용한다", () => {
    const result = buildVendorList(vendors, {
      academyId: "academy-1",
      filters: {
        kind: "피아노 조율",
      },
    });

    expect(result.items.map((vendor) => vendor.name)).toEqual(["스튜디오조율"]);
  });

  it("이름이 같은 거래처는 id 순서로 고정해 페이지 경계에서 중복·누락이 없다", () => {
    const sameNameVendors = Array.from({ length: 12 }, (_, index) => ({
      academyId: "academy-1",
      vendorId: `vendor-${String(12 - index).padStart(2, "0")}`,
      name: "같은이름",
      contact: "",
      kind: "교재",
      memo: "",
    }));

    const firstPage = buildVendorList(sameNameVendors, {
      academyId: "academy-1",
      page: 1,
      pageSize: 10,
    });
    const secondPage = buildVendorList(sameNameVendors, {
      academyId: "academy-1",
      page: 2,
      pageSize: 10,
    });

    expect(firstPage.items.map((vendor) => vendor.vendorId)).toEqual(
      Array.from({ length: 10 }, (_, index) =>
        `vendor-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(secondPage.items.map((vendor) => vendor.vendorId)).toEqual([
      "vendor-11",
      "vendor-12",
    ]);
  });

  it("요청한 페이지와 페이지 크기만큼만 보여주고 총 건수와 페이지 정보를 함께 준다", () => {
    const manyVendors = Array.from({ length: 25 }, (_, index) => ({
      academyId: "academy-1",
      vendorId: `vendor-${index + 1}`,
      name: `거래처${String(index + 1).padStart(2, "0")}`,
      contact: "",
      kind: "교재",
      memo: "",
    }));

    const result = buildVendorList(manyVendors, {
      academyId: "academy-1",
      page: 3,
      pageSize: 10,
    });

    expect(result.items.map((vendor) => vendor.name)).toEqual([
      "거래처21",
      "거래처22",
      "거래처23",
      "거래처24",
      "거래처25",
    ]);
    expect(result).toMatchObject({
      page: 3,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });

  it("종류 선택지는 검색·종류 필터·페이지와 상관없이 같은 학원의 전체 종류를 가나다순으로 준다", () => {
    const vendorsWithKinds = [
      ...vendors,
      {
        academyId: "academy-1",
        vendorId: "vendor-4",
        name: "수리공방",
        contact: "",
        kind: "악기 수리",
        memo: "",
      },
      {
        academyId: "academy-1",
        vendorId: "vendor-5",
        name: "또다른문구",
        contact: "",
        kind: "교재",
        memo: "",
      },
      {
        academyId: "academy-1",
        vendorId: "vendor-6",
        name: "종류없음",
        contact: "",
        kind: "",
        memo: "",
      },
      {
        academyId: "academy-2",
        vendorId: "vendor-7",
        name: "타학원공방",
        contact: "",
        kind: "다른학원 전용 종류",
        memo: "",
      },
    ];

    const filtered = buildVendorList(vendorsWithKinds, {
      academyId: "academy-1",
      search: "조율",
      filters: { kind: "피아노 조율" },
      page: 1,
      pageSize: 10,
    });

    expect(filtered.items.map((vendor) => vendor.name)).toEqual(["스튜디오조율"]);
    expect(filtered.kindOptions).toEqual(["교재", "악기 수리", "피아노 조율"]);
  });
});
