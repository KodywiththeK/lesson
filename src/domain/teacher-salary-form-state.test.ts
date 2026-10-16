import { describe, expect, it } from "vitest";

import { getInitialSalaryState } from "./teacher-salary-form-state";

describe("getInitialSalaryState", () => {
  it("새 선생님은 금액 칸을 비우고 비율만 4:6 기본값으로 둔다", () => {
    expect(getInitialSalaryState(undefined)).toEqual({
      monthlySalary: "",
      hourlyRate: "",
      ratioAcademyShare: "4",
      ratioTeacherShare: "6",
    });
  });

  it("선생님 몫 0%는 0:10으로 보여 준다(6으로 바꾸지 않는다)", () => {
    expect(getInitialSalaryState({ payType: "ratio", ratioTeacherShare: 0 })).toMatchObject({
      ratioAcademyShare: "10",
      ratioTeacherShare: "0",
    });
  });

  it("저장된 비율이 없으면 4:6을 채우지 않고 두 칸을 모두 비운다(저장하다 덮어쓰지 않도록)", () => {
    expect(getInitialSalaryState({ payType: "ratio" })).toEqual({
      monthlySalary: "",
      hourlyRate: "",
      ratioAcademyShare: "",
      ratioTeacherShare: "",
    });
  });

  it("10의 배수가 아닌 비율도 부동소수점 오차 없이 소수 첫째 자리로 보여 준다", () => {
    expect(getInitialSalaryState({ payType: "ratio", ratioTeacherShare: 65 })).toMatchObject({
      ratioAcademyShare: "3.5",
      ratioTeacherShare: "6.5",
    });
    expect(getInitialSalaryState({ payType: "ratio", ratioTeacherShare: 63 })).toMatchObject({
      ratioAcademyShare: "3.7",
      ratioTeacherShare: "6.3",
    });
    expect(getInitialSalaryState({ payType: "ratio", ratioTeacherShare: 100 })).toMatchObject({
      ratioAcademyShare: "0",
      ratioTeacherShare: "10",
    });
  });

  it("월급·시급이 저장돼 있으면 그대로 문자열로 보여 주고 없으면 비운다", () => {
    expect(getInitialSalaryState({ payType: "monthly", monthlySalary: 2_500_000 })).toMatchObject({
      monthlySalary: "2500000",
      hourlyRate: "",
    });
    expect(getInitialSalaryState({ payType: "hourly", hourlyRate: 30_000 })).toMatchObject({
      monthlySalary: "",
      hourlyRate: "30000",
    });
  });
});
