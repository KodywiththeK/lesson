import { describe, expect, it } from "vitest";

import { getSecondaryContactErrors } from "./student-secondary-contact";

describe("두 번째 연락처 검증", () => {
  it("둘 다 비어 있으면 저장하지 않는다", () => {
    expect(getSecondaryContactErrors("", "")).toEqual({});
  });

  it("관계 또는 번호만 있으면 빠진 입력을 필드별로 안내한다", () => {
    expect(getSecondaryContactErrors("모", "")).toEqual({ phone: "두 번째 연락처 번호를 입력해 주세요." });
    expect(getSecondaryContactErrors("", "010-1234-5678")).toEqual({ relationship: "두 번째 연락처 구분을 선택해 주세요." });
    expect(getSecondaryContactErrors("부", "123")).toEqual({ phone: "두 번째 연락처는 숫자 4자리 이상 입력해 주세요." });
  });
});
