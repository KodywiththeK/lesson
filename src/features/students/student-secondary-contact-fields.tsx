import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { contactRelationshipOptions } from "./student-form-options";
import { getSecondaryContactErrors } from "./student-secondary-contact";

export function StudentSecondaryContactFields({
  relationship,
  phone,
  onChange,
}: {
  relationship: string;
  phone: string;
  onChange: (patch: { relationship?: string; phone?: string }) => void;
}) {
  const errors = getSecondaryContactErrors(relationship, phone);
  const choices = relationship && !contactRelationshipOptions.includes(relationship)
    ? [...contactRelationshipOptions, relationship]
    : contactRelationshipOptions;

  return (
    <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
      <Label className="grid gap-1">
        <span>두 번째 연락처 구분 (선택)</span>
        <NativeSelect
          aria-label="두 번째 연락처 구분"
          aria-invalid={Boolean(errors.relationship)}
          value={relationship}
          onChange={(event) => onChange({ relationship: event.target.value })}
        >
          <NativeSelectOption value="">선택 안 함</NativeSelectOption>
          {choices.map((choice) => <NativeSelectOption key={choice} value={choice}>{choice}</NativeSelectOption>)}
        </NativeSelect>
        {errors.relationship ? <span role="alert" className="text-xs text-destructive">{errors.relationship}</span> : null}
      </Label>
      <Label className="grid gap-1">
        <span>두 번째 연락처 번호 (선택)</span>
        <Input
          aria-label="두 번째 연락처 번호"
          aria-invalid={Boolean(errors.phone)}
          value={phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          placeholder="010-0000-0000"
        />
        {errors.phone ? <span role="alert" className="text-xs text-destructive">{errors.phone}</span> : null}
      </Label>
    </div>
  );
}
