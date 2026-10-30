import { describe, expect, it } from "vitest";
import { allocatePayrollAmounts, renderPayrollMessage, validatePayrollTemplate } from "./payroll-message";
import { buildPayrollStudentBreakdown, type PayrollLessonSource } from "./payroll";

describe("선생님 정산 문자", () => {
  it("등록된 변수만 대체하고 알 수 없는 변수는 거부한다", () => {
    expect(validatePayrollTemplate("{선생님} 선생님 {월}월 {실수령액}원")).toEqual([]);
    expect(renderPayrollMessage("{선생님} 선생님 {월}월 {실수령액}원", {
      선생님: "김하늘", 월: "10", 실수령액: "248,036",
    })).toBe("김하늘 선생님 10월 248,036원");
    expect(validatePayrollTemplate("{선생님} {모르는변수}")).toEqual(["모르는변수"]);
    expect(() => renderPayrollMessage("{모르는변수}", {})).toThrow("지원하지 않는 변수");
  });

  it("학생별 소수 금액의 나머지는 소수점이 큰 순서로 배분한다", () => {
    expect(allocatePayrollAmounts([{ id: "a", amount: 100.2 }, { id: "b", amount: 200.8 }], 301))
      .toEqual([{ id: "a", amount: 100 }, { id: "b", amount: 201 }]);
    expect(() => allocatePayrollAmounts([{ id: "a", amount: 100 }], 200)).toThrow("정산 총액");
    expect(() => allocatePayrollAmounts([{ id: "a", amount: 100.2 }, { id: "b", amount: 200.1 }], 301)).toThrow("정산 총액");
  });

  it("월 급여의 수업별 매출과 같은 분모로 학생별 금액을 계산한다", () => {
    const lesson = (id: string, teacherId: string, status: PayrollLessonSource["status"]): PayrollLessonSource => ({
      academyId: "a", lessonEventId: id, teacherId, studentId: "s", studentName: "원생", instrumentName: "피아노",
      lessonKind: "academy", origin: "regular", status, startedAt: `2026-10-0${id}T10:00:00+09:00`,
      endedAt: `2026-10-0${id}T11:00:00+09:00`, monthlyLessonFee: 100001,
    });
    const result = buildPayrollStudentBreakdown({
      academyId: "a", month: "2026-10", teacherId: "t1", teacherShareRatio: 60, basePay: 30000,
      lessons: [lesson("1", "t1", "present"), lesson("2", "t2", "present")],
    });
    expect(result).toEqual([{ studentId: "s", studentName: "원생", instrumentName: "피아노", count: 1,
      dates: ["2026-10-01"], amount: 30000 }]);
  });
});
