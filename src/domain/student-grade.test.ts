import { describe, expect, it } from "vitest";

import {
  advanceStudentGrade,
  calculateAgeFromBirthYear,
  calculateBirthYearFromAge,
  getStudentDemographicValidationError,
  getSuggestedStudentGrade,
} from "./student-grade";

describe("원생 학년", () => {
  it("매년 1월 기준 나이에서 초·중·고 학년을 제안한다", () => {
    expect(getSuggestedStudentGrade(8)).toBe("초1");
    expect(getSuggestedStudentGrade(14)).toBe("중1");
    expect(getSuggestedStudentGrade(17)).toBe("고1");
    expect(getSuggestedStudentGrade(19)).toBe("고3");
    expect(getSuggestedStudentGrade(1)).toBe("유치원생(미취학아동)");
    expect(getSuggestedStudentGrade(7)).toBe("유치원생(미취학아동)");
    expect(getSuggestedStudentGrade(20)).toBe("");
  });

  it("현재 연도를 기준으로 나이와 출생연도를 서로 계산한다", () => {
    expect(calculateAgeFromBirthYear(2019, 2026)).toBe(8);
    expect(calculateBirthYearFromAge(8, 2026)).toBe(2019);
    expect(calculateAgeFromBirthYear(2027, 2026)).toBeUndefined();
    expect(calculateBirthYearFromAge(0, 2026)).toBeUndefined();
    expect(calculateAgeFromBirthYear(1899, 2026)).toBeUndefined();
    expect(calculateBirthYearFromAge(128, 2026)).toBeUndefined();
  });

  it("나이와 출생연도의 범위·동시 입력·일치 여부를 같은 규칙으로 검증한다", () => {
    expect(getStudentDemographicValidationError({ ageText: "", birthYearText: "", currentYear: 2026 })).toBeNull();
    expect(getStudentDemographicValidationError({ ageText: "999", birthYearText: "", currentYear: 2026 })).toContain("1세부터 127세");
    expect(getStudentDemographicValidationError({ ageText: "8", birthYearText: "20", currentYear: 2026 })).toContain("4자리");
    expect(getStudentDemographicValidationError({ ageText: "8", birthYearText: "2018", currentYear: 2026 })).toContain("일치하지");
    expect(getStudentDemographicValidationError({ ageText: "8", birthYearText: "2019", currentYear: 2026 })).toBeNull();
  });

  it("저장된 선택 학년은 새해마다 진급하고 고3 다음 해에는 비운다", () => {
    expect(advanceStudentGrade("초6", 1)).toBe("중1");
    expect(advanceStudentGrade("중3", 1)).toBe("고1");
    expect(advanceStudentGrade("고2", 1)).toBe("고3");
    expect(advanceStudentGrade("고3", 1)).toBe("");
    expect(advanceStudentGrade("초5", 2)).toBe("중1");
  });

  it("변환할 수 없는 기존 학년은 손실 없이 유지한다", () => {
    expect(advanceStudentGrade("중학교 1학년", 2)).toBe("중학교 1학년");
  });

  it("미취학 학년은 7세까지 유지하고 8세가 되는 해에 초1로 진급한다", () => {
    expect(advanceStudentGrade("유치원생(미취학아동)", 1, 6)).toBe("유치원생(미취학아동)");
    expect(advanceStudentGrade("유치원생(미취학아동)", 1, 7)).toBe("초1");
  });
});
