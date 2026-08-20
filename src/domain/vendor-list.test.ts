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
});
