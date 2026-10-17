import { DateField } from "@/components/operations/date-time-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import {
  getRelationshipChoices,
  type StudentBasicFormValues,
} from "./student-basic-info";

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
            onChange={(event) => onChange({ age: event.target.value })}
          />
        </Label>
        <Label className="grid gap-1">
          <span>학년</span>
          <Input
            aria-label="학년"
            value={values.grade}
            onChange={(event) => onChange({ grade: event.target.value })}
          />
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
            onChange={(event) => onChange({ occupation: event.target.value })}
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
    </>
  );
}
