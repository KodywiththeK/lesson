const SCHOOL_GRADES = [
  "초1", "초2", "초3", "초4", "초5", "초6",
  "중1", "중2", "중3",
  "고1", "고2", "고3",
] as const;

const FIRST_GRADE_AGE = 8;

export function getSuggestedStudentGrade(age: number): string {
  return Number.isInteger(age) ? SCHOOL_GRADES[age - FIRST_GRADE_AGE] ?? "" : "";
}

const ADULT_AGE = 20;

/** 입력한 나이가 성인 미만이면 "학생", 비었거나 성인이면 제안하지 않는다("") */
export function getSuggestedStudentOccupation(ageText: string): string {
  return ageText !== "" && Number(ageText) < ADULT_AGE ? "학생" : "";
}

export function advanceStudentGrade(grade: string, elapsedYears: number): string {
  const index = SCHOOL_GRADES.findIndex((candidate) => candidate === grade);
  if (index < 0) return grade;
  return SCHOOL_GRADES[index + Math.max(0, elapsedYears)] ?? "";
}

export function getStudentDisplayGrade(
  student: { grade?: string; gradeAsOfYear?: number },
  today: string,
): string {
  if (!student.grade || student.gradeAsOfYear === undefined) return student.grade ?? "";
  return advanceStudentGrade(student.grade, Number(today.slice(0, 4)) - student.gradeAsOfYear);
}

export const STUDENT_GRADE_OPTIONS = SCHOOL_GRADES;
