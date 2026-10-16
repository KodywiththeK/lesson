import type { TeacherListRow } from "./teacher-list";

/** 비율제 폼은 학원 몫 + 선생님 몫 = 10으로 입력하고, 저장은 선생님 몫 × 10(퍼센트)이다. */
const PERCENT_PER_FORM_UNIT = 10;
const TOTAL_PERCENT = 100;
const NEW_TEACHER_RATIO = { academy: "4", teacher: "6" };

type SalaryFormSource = Pick<TeacherListRow, "payType" | "monthlySalary" | "hourlyRate" | "ratioTeacherShare">;

/** 급여 폼 입력 칸의 시작 값. 저장된 값이 없는 칸은 비워 두어 저장하면서 임의 값으로 덮어쓰지 않게 한다. */
export function getInitialSalaryState(teacher: SalaryFormSource | undefined) {
  if (!teacher) {
    return {
      monthlySalary: "",
      hourlyRate: "",
      ratioAcademyShare: NEW_TEACHER_RATIO.academy,
      ratioTeacherShare: NEW_TEACHER_RATIO.teacher,
    };
  }

  const hasRatio = teacher.ratioTeacherShare !== undefined;

  return {
    monthlySalary: teacher.monthlySalary ? String(teacher.monthlySalary) : "",
    hourlyRate: teacher.hourlyRate ? String(teacher.hourlyRate) : "",
    // 퍼센트를 정수로 나눠 한 번에 문자열로 만들어 10 - x 같은 부동소수점 오차(3.7000000000000002)를 피한다.
    ratioAcademyShare: hasRatio
      ? String((TOTAL_PERCENT - (teacher.ratioTeacherShare ?? 0)) / PERCENT_PER_FORM_UNIT)
      : "",
    ratioTeacherShare: hasRatio ? String((teacher.ratioTeacherShare ?? 0) / PERCENT_PER_FORM_UNIT) : "",
  };
}
