import { describe, expect, it } from "vitest";

import { registerVendor } from "./vendor";

describe("registerVendor", () => {
  it("거래처명, 연락처, 종류, 비고를 기록한다", () => {
    const result = registerVendor({
      academyId: "academy-1",
      vendorId: "vendor-1",
      name: "예음문구",
      contact: "02-123-4567",
      kind: "교재",
      memo: "바이엘 재고 월 1회 확인",
    });

    expect(result).toStrictEqual({
      academyId: "academy-1",
      vendorId: "vendor-1",
      name: "예음문구",
      contact: "02-123-4567",
      kind: "교재",
      memo: "바이엘 재고 월 1회 확인",
      active: true,
    });
  });

  it("거래처명과 종류는 필수다", () => {
    expect(() =>
      registerVendor({
        academyId: "academy-1",
        vendorId: "vendor-1",
        name: " ",
        contact: "02-123-4567",
        kind: "교재",
        memo: "",
      }),
    ).toThrow("거래처명은 필수입니다.");

    expect(() =>
      registerVendor({
        academyId: "academy-1",
        vendorId: "vendor-1",
        name: "예음문구",
        contact: "02-123-4567",
        kind: " ",
        memo: "",
      }),
    ).toThrow("거래처 종류는 필수입니다.");
  });
});
