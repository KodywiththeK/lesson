import { describe, expect, it } from "vitest";

import { advanceStudentGrade, getSuggestedStudentGrade } from "./student-grade";

describe("원생 학년", () => {
  it("매년 1월 기준 나이에서 초·중·고 학년을 제안한다", () => {
    expect(getSuggestedStudentGrade(8)).toBe("초1");
    expect(getSuggestedStudentGrade(14)).toBe("중1");
    expect(getSuggestedStudentGrade(17)).toBe("고1");
    expect(getSuggestedStudentGrade(19)).toBe("고3");
    expect(getSuggestedStudentGrade(7)).toBe("");
    expect(getSuggestedStudentGrade(20)).toBe("");
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
});
