import { useRef } from "react";

import { DateField } from "@/components/operations/date-time-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getSuggestedStudentGrade, getSuggestedStudentOccupation, STUDENT_GRADE_OPTIONS } from "@/domain/student-grade";

import {
  getRelationshipChoices,
  type StudentBasicFormValues,
} from "./student-basic-info";
import { StudentSecondaryContactFields } from "./student-secondary-contact-fields";

/** 원생 수정 폼의 이름·등록일·나이·학년·학교·직업·연락처 입력. 등록 폼과 같은 필드다. */
export function StudentBasicInfoFields({
  values,
  phoneError,
  onChange,
}: {
  values: StudentBasicFormValues;
  phoneError: string | null;
  onChange: (patch: Partial<StudentBasicFormValues>) => void;
}) {
  const gradeWasSelected = useRef(Boolean(values.grade));
  const occupationWasEdited = useRef(Boolean(values.occupation));
  const gradeOptions = STUDENT_GRADE_OPTIONS.includes(values.grade as typeof STUDENT_GRADE_OPTIONS[number])
    ? STUDENT_GRADE_OPTIONS
    : [...STUDENT_GRADE_OPTIONS, values.grade].filter(Boolean);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>원생명</span>
          <Input
            aria-label="원생명"
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Label>
        <Label className="grid gap-1">
          <span>등록일</span>
          <DateField
            aria-label="등록일"
            value={values.registeredOn}
            onValueChange={(registeredOn) => onChange({ registeredOn })}
          />
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Label className="grid gap-1">
          <span>나이</span>
          <Input
            aria-label="나이"
            min={0}
            type="number"
            value={values.age}
            onChange={(event) => {
              const age = event.target.value;
              const suggestedOccupation = getSuggestedStudentOccupation(age);
              onChange({
                age,
                ...(!gradeWasSelected.current ? { grade: getSuggestedStudentGrade(Number(age)) } : {}),
                ...(!occupationWasEdited.current && suggestedOccupation ? { occupation: suggestedOccupation } : {}),
              });
            }}
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
          {values.grade && !STUDENT_GRADE_OPTIONS.includes(values.grade as typeof STUDENT_GRADE_OPTIONS[number]) ? (
            <span className="text-xs text-muted-foreground">기존 학년입니다. 수정할 때 목록에서 새 학년을 선택해 주세요.</span>
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
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Label className="grid gap-1">
          <span>연락처 구분</span>
          <NativeSelect
            aria-label="연락처 구분"
            value={values.contactRelationship}
            onChange={(event) => onChange({ contactRelationship: event.target.value })}
          >
            {getRelationshipChoices(values.contactRelationship).map((relationship) => (
              <NativeSelectOption key={relationship} value={relationship}>
                {relationship}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>연락처</span>
          <Input
            aria-label="연락처"
            aria-invalid={Boolean(phoneError)}
            value={values.contactPhone}
            onChange={(event) => onChange({ contactPhone: event.target.value })}
            placeholder="010-0000-0000"
          />
          {phoneError ? <span className="text-sm text-destructive">{phoneError}</span> : null}
        </Label>
      </div>
      <StudentSecondaryContactFields
        relationship={values.secondaryContactRelationship}
        phone={values.secondaryContactPhone}
        onChange={(patch) => onChange({
          ...(patch.relationship !== undefined ? { secondaryContactRelationship: patch.relationship } : {}),
          ...(patch.phone !== undefined ? { secondaryContactPhone: patch.phone } : {}),
        })}
      />
    </>
  );
}
