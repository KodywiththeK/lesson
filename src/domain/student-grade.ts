const SCHOOL_GRADES = [
  "초1", "초2", "초3", "초4", "초5", "초6",
  "중1", "중2", "중3",
  "고1", "고2", "고3",
] as const;

const FIRST_GRADE_AGE = 8;
const MIN_STUDENT_AGE = 1;
const MAX_STUDENT_AGE = 127;
const MAX_PRESCHOOL_AGE = FIRST_GRADE_AGE - 1;
const PRESCHOOL_GRADE = "유치원생(미취학아동)";

export function getSuggestedStudentGrade(age: number): string {
  if (Number.isInteger(age) && age >= MIN_STUDENT_AGE && age <= MAX_PRESCHOOL_AGE) {
    return PRESCHOOL_GRADE;
  }
  return Number.isInteger(age) ? SCHOOL_GRADES[age - FIRST_GRADE_AGE] ?? "" : "";
}

export function calculateAgeFromBirthYear(
  birthYear: number,
  currentYear: number,
): number | undefined {
  const age = currentYear - birthYear + 1;
  return Number.isInteger(birthYear) && Number.isInteger(currentYear)
    && age >= MIN_STUDENT_AGE && age <= MAX_STUDENT_AGE
    ? age
    : undefined;
}

export function calculateBirthYearFromAge(
  age: number,
  currentYear: number,
): number | undefined {
  return Number.isInteger(age) && age >= MIN_STUDENT_AGE && age <= MAX_STUDENT_AGE
    && Number.isInteger(currentYear)
    ? currentYear - age + 1
    : undefined;
}

export function getStudentDemographicValidationError({
  ageText,
  birthYearText,
  currentYear,
}: {
  ageText: string;
  birthYearText: string;
  currentYear: number;
}): string | null {
  if (!ageText && !birthYearText) return null;

  if (!ageText) {
    if (!/^\d{4}$/.test(birthYearText)) {
      return "출생연도는 4자리 숫자로 입력해 주세요.";
    }

    return "출생연도에 맞는 나이를 확인해 주세요.";
  }

  const age = Number(ageText);
  if (!/^\d+$/.test(ageText) || !Number.isInteger(age) || age < MIN_STUDENT_AGE || age > MAX_STUDENT_AGE) {
    return `나이는 ${MIN_STUDENT_AGE}세부터 ${MAX_STUDENT_AGE}세 사이로 입력해 주세요.`;
  }

  if (!/^\d{4}$/.test(birthYearText)) {
    return "출생연도는 4자리 숫자로 입력해 주세요.";
  }

  const birthYear = Number(birthYearText);
  if (calculateAgeFromBirthYear(birthYear, currentYear) !== age) {
    return "나이와 출생연도가 일치하지 않습니다. 다시 확인해 주세요.";
  }

  return null;
}

const ADULT_AGE = 20;

/** 입력한 나이가 성인 미만이면 "학생", 비었거나 성인이면 제안하지 않는다("") */
export function getSuggestedStudentOccupation(ageText: string): string {
  return ageText !== "" && Number(ageText) < ADULT_AGE ? "학생" : "";
}

export function advanceStudentGrade(
  grade: string,
  elapsedYears: number,
  ageAtGrade?: number,
): string {
  if (grade === PRESCHOOL_GRADE) {
    const currentAge = ageAtGrade === undefined ? undefined : ageAtGrade + Math.max(0, elapsedYears);
    return currentAge === undefined || currentAge < FIRST_GRADE_AGE
      ? PRESCHOOL_GRADE
      : SCHOOL_GRADES[currentAge - FIRST_GRADE_AGE] ?? "";
  }
  const index = SCHOOL_GRADES.findIndex((candidate) => candidate === grade);
  if (index < 0) return grade;
  return SCHOOL_GRADES[index + Math.max(0, elapsedYears)] ?? "";
}

export function getStudentDisplayGrade(
  student: { grade?: string; gradeAsOfYear?: number; age?: number; ageAsOfYear?: number },
  today: string,
): string {
  if (!student.grade || student.gradeAsOfYear === undefined) return student.grade ?? "";
  const currentYear = Number(today.slice(0, 4));
  const ageAtGrade = student.age === undefined
    ? undefined
    : student.age + Math.max(0, student.gradeAsOfYear - (student.ageAsOfYear ?? student.gradeAsOfYear));
  return advanceStudentGrade(student.grade, currentYear - student.gradeAsOfYear, ageAtGrade);
}

export const STUDENT_GRADE_OPTIONS = [PRESCHOOL_GRADE, ...SCHOOL_GRADES] as const;
