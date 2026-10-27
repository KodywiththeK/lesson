import { describe, expect, it } from "vitest";

import {
  chooseActiveAcademy,
  normalizeKoreanMobile,
  resolveJoinDisplayStatus,
} from "./auth-onboarding";

describe("가입과 학원 선택 규칙", () => {
  it("이름과 휴대폰은 직접 입력한 국내 번호만 정규화한다", () => {
    expect(normalizeKoreanMobile("010-1234-5678")).toBe("01012345678");
    expect(normalizeKoreanMobile("02-123-4567")).toBeNull();
    expect(normalizeKoreanMobile("010-123-456")).toBeNull();
  });

  it("마지막 학원이 활성 상태면 다시 선택하고, 사용할 수 없으면 선택을 요구한다", () => {
    const memberships = [
      { academyId: "a", academyName: "가 학원", role: "owner" as const },
      { academyId: "b", academyName: "나 학원", role: "teacher" as const },
    ];
    expect(chooseActiveAcademy(memberships, "b")?.academyId).toBe("b");
    expect(chooseActiveAcademy(memberships, "missing")).toBeNull();
    expect(chooseActiveAcademy(memberships, null)).toBeNull();
    expect(chooseActiveAcademy(memberships.slice(0, 1), null)?.academyId).toBe("a");
  });

  it("승인 요청과 멤버십을 결합해 네 가지 직원 상태를 표시한다", () => {
    expect(resolveJoinDisplayStatus({ requestStatus: "pending" })).toBe("대기");
    expect(resolveJoinDisplayStatus({ requestStatus: "rejected" })).toBe("반려");
    expect(resolveJoinDisplayStatus({ membershipStatus: "active" })).toBe("활성");
    expect(resolveJoinDisplayStatus({ membershipStatus: "disabled" })).toBe("비활성");
  });
});
