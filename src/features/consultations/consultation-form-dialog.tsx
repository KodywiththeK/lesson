import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONSULTATION_INSTRUMENT_NAMES,
  CONSULTATION_MAX_AGE,
  CONSULTATION_MAX_LENGTH,
  validateConsultationForm,
  type ConsultationFormValues,
  type ConsultationProfile,
} from "@/domain/consultation";

const EMPTY_FORM_VALUES: ConsultationFormValues = {
  name: "",
  age: "",
  instrumentNames: [],
  phone: "",
  school: "",
  memo: "",
};

type ConsultationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 있으면 다이얼로그를 여는 버튼으로 쓴다. 없으면 `open`으로만 제어한다. */
  trigger?: ReactNode;
  title: "상담 등록" | "상담 수정";
  description: string;
  /** 수정할 때 저장된 값. 없으면 빈 폼으로 시작한다. */
  initialValues?: ConsultationFormValues;
  isSubmitting: boolean;
  onSubmit: (profile: ConsultationProfile) => void;
};

/** 상담 등록과 수정이 같은 입력 항목을 쓰도록 한 다이얼로그로 둔다. 접수일은 서버가 정하므로 입력받지 않는다. */
export function ConsultationFormDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  initialValues = EMPTY_FORM_VALUES,
  isSubmitting,
  onSubmit,
}: ConsultationFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ConsultationForm
          formLabel={`${title} 입력`}
          initialValues={initialValues}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function ConsultationForm({
  formLabel,
  initialValues,
  isSubmitting,
  onSubmit,
}: {
  formLabel: string;
  initialValues: ConsultationFormValues;
  isSubmitting: boolean;
  onSubmit: (profile: ConsultationProfile) => void;
}) {
  const [values, setValues] = useState(initialValues);
  const disabledReasonId = useId();
  const validation = validateConsultationForm(values);
  const canSubmit = validation.ok && !isSubmitting;

  function changeField<TField extends keyof ConsultationFormValues>(
    field: TField,
    value: ConsultationFormValues[TField],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleInstrument(instrumentName: string, checked: boolean) {
    changeField(
      "instrumentNames",
      checked
        ? [...new Set([...values.instrumentNames, instrumentName])]
        : values.instrumentNames.filter((name) => name !== instrumentName),
    );
  }

  return (
    <form
      aria-label={formLabel}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (validation.ok && !isSubmitting) {
          onSubmit(validation.profile);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Label className="grid gap-1">
          <span>이름 (필수)</span>
          <Input
            aria-label="이름"
            aria-required
            maxLength={CONSULTATION_MAX_LENGTH.name}
            value={values.name}
            onChange={(event) => changeField("name", event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>나이</span>
          <Input
            aria-label="나이"
            type="number"
            min={0}
            max={CONSULTATION_MAX_AGE}
            step={1}
            value={values.age}
            onChange={(event) => changeField("age", event.target.value)}
          />
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>전화번호 (필수)</span>
          <Input
            aria-label="전화번호"
            aria-required
            maxLength={CONSULTATION_MAX_LENGTH.phone}
            placeholder="010-0000-0000"
            value={values.phone}
            onChange={(event) => changeField("phone", event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>학교</span>
          <Input
            aria-label="학교"
            maxLength={CONSULTATION_MAX_LENGTH.school}
            value={values.school}
            onChange={(event) => changeField("school", event.target.value)}
          />
        </Label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">
          악기 선택 <span className="text-muted-foreground">(복수 선택 가능)</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-4">
          {CONSULTATION_INSTRUMENT_NAMES.map((instrumentName) => (
            <Label key={instrumentName} className="flex items-center gap-2">
              <Checkbox
                aria-label={`${instrumentName} 선택`}
                checked={values.instrumentNames.includes(instrumentName)}
                onCheckedChange={(checked) => toggleInstrument(instrumentName, checked === true)}
              />
              <span>{instrumentName}</span>
            </Label>
          ))}
        </div>
      </fieldset>

      <Label className="grid gap-1">
        <span>특이사항</span>
        <Textarea
          aria-label="특이사항"
          maxLength={CONSULTATION_MAX_LENGTH.memo}
          value={values.memo}
          onChange={(event) => changeField("memo", event.target.value)}
        />
      </Label>

      <DialogFooter className="items-center sm:justify-between">
        <p id={disabledReasonId} className="text-sm text-muted-foreground">
          {validation.ok ? null : validation.reason}
        </p>
        <Button
          type="submit"
          disabled={!canSubmit}
          aria-describedby={validation.ok ? undefined : disabledReasonId}
        >
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
