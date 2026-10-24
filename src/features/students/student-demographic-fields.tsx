import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getFinanceToday } from "@/domain/finance-date";
import {
  calculateAgeFromBirthYear,
  calculateBirthYearFromAge,
  getSuggestedStudentGrade,
  getSuggestedStudentOccupation,
  getStudentDemographicValidationError,
  STUDENT_GRADE_OPTIONS,
} from "@/domain/student-grade";

export type StudentDemographicValues = {
  age: string;
  birthYear: string;
  grade: string;
  school: string;
  occupation: string;
};

type StudentDemographicFieldsProps = {
  values: StudentDemographicValues;
  hasManualGradeInitially?: boolean;
  hasManualOccupationInitially?: boolean;
  onChange: (patch: Partial<StudentDemographicValues>) => void;
};

export function StudentDemographicFields({
  values,
  hasManualGradeInitially = Boolean(values.grade),
  hasManualOccupationInitially = Boolean(values.occupation),
  onChange,
}: StudentDemographicFieldsProps) {
  const gradeWasSelected = useRef(hasManualGradeInitially);
  const occupationWasEdited = useRef(hasManualOccupationInitially);
  const currentYear = Number(getFinanceToday().slice(0, 4));
  const demographicError = getStudentDemographicValidationError({
    ageText: values.age,
    birthYearText: values.birthYear,
    currentYear,
  });
  const gradeOptions = STUDENT_GRADE_OPTIONS.includes(
    values.grade as (typeof STUDENT_GRADE_OPTIONS)[number],
  )
    ? STUDENT_GRADE_OPTIONS
    : [...STUDENT_GRADE_OPTIONS, values.grade].filter(Boolean);

  function updateAge(age: string) {
    if (!age) {
      onChange({ age: "", birthYear: "" });
      return;
    }

    const numericAge = Number(age);
    const birthYear = calculateBirthYearFromAge(numericAge, currentYear);
    const suggestedOccupation = getSuggestedStudentOccupation(age);

    onChange({
      age,
      birthYear: birthYear === undefined ? "" : String(birthYear),
      ...getAutomaticStudentFields(numericAge, suggestedOccupation),
    });
  }

  function updateBirthYear(birthYear: string) {
    if (!birthYear) {
      onChange({ age: "", birthYear: "" });
      return;
    }

    const age = /^\d{4}$/.test(birthYear)
      ? calculateAgeFromBirthYear(Number(birthYear), currentYear)
      : undefined;
    const ageText = age === undefined ? "" : String(age);
    const suggestedOccupation = getSuggestedStudentOccupation(ageText);

    onChange({
      birthYear,
      age: ageText,
      ...getAutomaticStudentFields(age, suggestedOccupation),
    });
  }

  function getAutomaticStudentFields(age: number | undefined, suggestedOccupation: string) {
    return {
      ...(!gradeWasSelected.current && age !== undefined
        ? { grade: getSuggestedStudentGrade(age) }
        : {}),
      ...(!occupationWasEdited.current && suggestedOccupation
        ? { occupation: suggestedOccupation }
        : {}),
    };
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Label className="grid gap-1">
        <span>나이</span>
        <Input
          aria-label="나이"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-invalid={Boolean(demographicError)}
          value={values.age}
          onChange={(event) => updateAge(event.target.value)}
        />
      </Label>
      <Label className="grid gap-1">
        <span>출생연도</span>
        <Input
          aria-label="출생연도"
          inputMode="numeric"
          pattern="[0-9]{4}"
          aria-invalid={Boolean(demographicError)}
          placeholder="예: 2019"
          value={values.birthYear}
          onChange={(event) => updateBirthYear(event.target.value)}
        />
      </Label>
      <Label className="grid gap-1">
        <span>학년</span>
        <NativeSelect
          aria-label="학년"
          value={values.grade}
          onChange={(event) => {
            gradeWasSelected.current = true;
            onChange({ grade: event.target.value });
          }}
        >
          <NativeSelectOption value="">학년 선택</NativeSelectOption>
          {gradeOptions.map((grade) => (
            <NativeSelectOption key={grade} value={grade}>{grade}</NativeSelectOption>
          ))}
        </NativeSelect>
        {values.grade && !STUDENT_GRADE_OPTIONS.includes(
          values.grade as (typeof STUDENT_GRADE_OPTIONS)[number],
        ) ? (
          <span className="text-xs text-muted-foreground">
            기존 학년입니다. 수정할 때 목록에서 새 학년을 선택해 주세요.
          </span>
        ) : null}
      </Label>
      <Label className="grid gap-1">
        <span>학교</span>
        <Input
          aria-label="학교"
          value={values.school}
          onChange={(event) => onChange({ school: event.target.value })}
        />
      </Label>
      <Label className="grid gap-1">
        <span>직업</span>
        <Input
          aria-label="직업"
          value={values.occupation}
          onChange={(event) => {
            occupationWasEdited.current = true;
            onChange({ occupation: event.target.value });
          }}
        />
      </Label>
      {demographicError ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-5">
          {demographicError}
        </p>
      ) : null}
    </div>
  );
}
