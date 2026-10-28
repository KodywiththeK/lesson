import { useEffect, useId, useRef, useState } from "react";

import { MonthField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { parseWonInput } from "@/domain/money-input";
import {
  describeManualLessonFee,
  getLessonFeeSubmission,
  repriceLessonFee,
  resetLessonFeeToPriceTable,
  setLessonFeeManually,
  type LessonFeeContext,
  type LessonFeeDraft,
} from "@/domain/lesson-fee-draft";
import {
  calculateLessonFee,
  getProgressOptions,
  PRIVATE_LESSON_MINUTE_OPTIONS,
  STUDENT_DISCOUNTS,
  type StudentDiscountKind,
} from "@/domain/lesson-pricing";

type StudentLessonFeeFieldsProps = {
  /** 한 화면에 악기 카드가 여러 개일 때 접근 가능한 이름을 구분하는 접두사(예: "피아노 "). */
  labelPrefix?: string;
  context: LessonFeeContext;
  /** 지인 소개 할인 달의 기본값으로 쓰는 등록 달 `YYYY-MM`. */
  referenceMonth: string;
  draft: LessonFeeDraft;
  onChange: (draft: LessonFeeDraft) => void;
};

function getAutomaticMonthlySessionLabel(weekdayCount: number) {
  if (weekdayCount === 0) return "기본 월 4회 · 요일 선택 시 조정";
  if (weekdayCount === 1) return "월 4회";
  if (weekdayCount === 2) return "월 8회";
  return "";
}

/** 진도·가격표 레슨비·할인·최종 수강료 입력. 원생 등록과 수정 폼이 함께 쓴다. */
export function StudentLessonFeeFields({
  labelPrefix = "",
  context,
  referenceMonth,
  draft,
  onChange,
}: StudentLessonFeeFieldsProps) {
  const withPrefix = (text: string) => `${labelPrefix}${text}`;
  const priceResult = calculateLessonFee({
    ...context,
    progress: draft.progress,
    sessionsPerMonth: draft.sessionsPerMonth,
    minutes: draft.minutes || undefined,
  });
  const submission = getLessonFeeSubmission(draft, referenceMonth);
  const isPrivateLesson = context.lessonType === "private";
  const feeNoticeId = `${labelPrefix}lesson-fee-notice`.replace(/\s+/g, "-");
  const feeInputId = useId();
  const requiresManualSessionCount = isPrivateLesson && context.weekdayCount >= 3;
  const hasPresetMinutes = PRIVATE_LESSON_MINUTE_OPTIONS.some((minutes) => minutes === draft.minutes);
  const [customMinutesSelected, setCustomMinutesSelected] = useState(!hasPresetMinutes && draft.minutes !== 0);
  const [lastCustomMinutes, setLastCustomMinutes] = useState<number | null>(!hasPresetMinutes ? draft.minutes : null);
  const showCustomMinutes = (!hasPresetMinutes && draft.minutes !== 0)
    || (customMinutesSelected && draft.minutes === lastCustomMinutes);
  const [feeText, setFeeText] = useState(String(draft.lessonFee));
  const lastInputFee = useRef(draft.lessonFee);
  const [legacyDiscountText, setLegacyDiscountText] = useState(String(draft.otherDiscount.amount));
  const [isEditingLegacyDiscount, setIsEditingLegacyDiscount] = useState(false);
  const lastInputDiscount = useRef(draft.otherDiscount.amount);
  const showLegacyDiscount = draft.otherDiscount.amount > 0 || isEditingLegacyDiscount;

  useEffect(() => {
    if (draft.lessonFee !== lastInputFee.current) {
      lastInputFee.current = draft.lessonFee;
      setFeeText(String(draft.lessonFee));
    }
  }, [draft.lessonFee]);

  useEffect(() => {
    if (draft.otherDiscount.amount !== lastInputDiscount.current) {
      lastInputDiscount.current = draft.otherDiscount.amount;
      setLegacyDiscountText(String(draft.otherDiscount.amount));
    }
  }, [draft.otherDiscount.amount]);

  function updatePricingInput(patch: Partial<LessonFeeDraft>) {
    onChange(repriceLessonFee({ ...draft, ...patch }, context));
  }

  function toggleDiscount(kind: StudentDiscountKind, checked: boolean) {
    onChange({
      ...draft,
      discountKinds: checked
        ? [...draft.discountKinds, kind]
        : draft.discountKinds.filter((value) => value !== kind),
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ProgressField
          label={withPrefix("진도")}
          options={getProgressOptions(context.instrumentName, context.lessonType)}
          value={draft.progress}
          onChange={(progress) => updatePricingInput({ progress })}
        />
        {isPrivateLesson ? (
          <>
            <Label className="grid gap-1">
              <span>월 횟수</span>
              {requiresManualSessionCount ? (
                <Input
                  aria-label={withPrefix("월 횟수")}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draft.sessionsPerMonth || ""}
                  onChange={(event) => updatePricingInput({
                    sessionsPerMonth: Number(event.target.value) || 0,
                  })}
                />
              ) : (
                <Input
                  aria-label={withPrefix("월 횟수")}
                  readOnly
                  value={getAutomaticMonthlySessionLabel(context.weekdayCount)}
                />
              )}
            </Label>
            <Label className="grid gap-1">
              <span>수업 시간</span>
              <NativeSelect
                aria-label={withPrefix("수업 시간")}
                value={showCustomMinutes ? "custom" : draft.minutes ? String(draft.minutes) : ""}
                onChange={(event) => {
                  const isCustom = event.target.value === "custom";
                  setCustomMinutesSelected(isCustom);
                  setLastCustomMinutes(isCustom ? 0 : null);
                  updatePricingInput({ minutes: isCustom ? 0 : Number(event.target.value) || 0 });
                }}
              >
                <NativeSelectOption value="">선택해 주세요</NativeSelectOption>
                {PRIVATE_LESSON_MINUTE_OPTIONS.map((minutes) => (
                  <NativeSelectOption key={minutes} value={minutes}>
                    {minutes}분
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value="custom">직접 입력</NativeSelectOption>
              </NativeSelect>
            </Label>
            {showCustomMinutes ? (
              <Label className="grid gap-1">
                <span>직접 입력 수업 시간</span>
                <Input aria-label={withPrefix("직접 입력 수업 시간")} inputMode="numeric"
                  value={draft.minutes || ""} aria-invalid={!Number.isInteger(draft.minutes) || draft.minutes < 5 || draft.minutes > 240}
                  onChange={(event) => {
                    const minutes = Number(event.target.value) || 0;
                    setLastCustomMinutes(minutes);
                    updatePricingInput({ minutes });
                  }} />
                <span className="text-xs text-muted-foreground">5~240분의 정수를 입력해 주세요.</span>
              </Label>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <span className="flex items-center justify-between gap-2">
            <Label htmlFor={feeInputId}>레슨비</Label>
            {priceResult.status === "priced" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(resetLessonFeeToPriceTable(draft, context))}
              >
                가격표로 재계산
              </Button>
            ) : null}
          </span>
          <Input
            id={feeInputId}
            aria-label={withPrefix("레슨비")}
            aria-describedby={feeNoticeId}
            type="text"
            inputMode="numeric"
            pattern="(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)"
            required
            aria-invalid={(parseWonInput(feeText) ?? 0) <= 0}
            value={feeText}
            onChange={(event) => {
              const text = event.target.value;
              const amount = parseWonInput(text) ?? 0;
              lastInputFee.current = amount;
              setFeeText(text);
              onChange(setLessonFeeManually(draft, amount));
            }}
            onBlur={() => {
              const amount = parseWonInput(feeText);
              if (amount !== null) setFeeText(amount.toLocaleString("ko-KR"));
            }}
          />
        </div>
        <Label className="grid gap-1">
          <span>최종 수강료 (매달)</span>
          <Input
            aria-label={withPrefix("최종 수강료")}
            type="number"
            readOnly
            value={submission.finalMonthlyFee}
          />
        </Label>
      </div>
      <p id={feeNoticeId} className="-mt-2 text-xs text-muted-foreground">
        {priceResult.status === "manual" ? describeManualLessonFee(priceResult.reason) : null}
        {priceResult.status === "priced" && priceResult.fee !== draft.lessonFee
          ? `직접 입력한 레슨비입니다. 가격표 금액은 ${priceResult.fee.toLocaleString("ko-KR")}원입니다.`
          : null}
      </p>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">할인 (복수 선택 가능)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-border bg-muted/40 p-3">
          {STUDENT_DISCOUNTS.map((discount) => (
            <Label key={discount.kind} className="flex items-center gap-2">
              <Checkbox
                aria-label={withPrefix(discount.label)}
                checked={draft.discountKinds.includes(discount.kind)}
                onCheckedChange={(checked) => toggleDiscount(discount.kind, checked === true)}
              />
              <span>
                {discount.label}{" "}
                <span className="text-muted-foreground">
                  ({discount.scope === "monthly" ? "매달" : "소개한 달만"} -
                  {discount.amount.toLocaleString("ko-KR")}원)
                </span>
              </span>
            </Label>
          ))}
        </div>
      </fieldset>

      {draft.discountKinds.includes("referral") ? (
        <Label className="grid max-w-xs gap-1">
          <span>지인 소개 할인 월</span>
          <MonthField
            aria-label={withPrefix("지인 소개 할인 월")}
            value={draft.referralMonth ?? referenceMonth}
            onValueChange={(referralMonth) => onChange({ ...draft, referralMonth })}
          />
        </Label>
      ) : null}

      {showLegacyDiscount ? (
        <Label className="grid max-w-xs gap-1">
          <span>{draft.otherDiscount.label} (매달, 이전에 입력한 금액)</span>
          <Input
            aria-label={withPrefix("기존 할인액")}
            type="text"
            inputMode="numeric"
            pattern="(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)"
            aria-invalid={legacyDiscountText !== "" && parseWonInput(legacyDiscountText) === null}
            value={legacyDiscountText}
            onChange={(event) => {
              const text = event.target.value;
              const amount = parseWonInput(text) ?? 0;
              lastInputDiscount.current = amount;
              setIsEditingLegacyDiscount(true);
              setLegacyDiscountText(text);
              onChange({
                ...draft,
                otherDiscount: { ...draft.otherDiscount, amount },
              });
            }}
          />
        </Label>
      ) : null}
    </div>
  );
}

/** 진도 선택. 저장된 값이 목록 밖이면 그 값을 그대로 보여 주고, 가격표가 없는 수업은 직접 입력한다. */
function ProgressField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (progress: string) => void;
}) {
  if (options.length === 0) {
    return (
      <Label className="grid gap-1">
        <span>진도</span>
        <Input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
      </Label>
    );
  }

  const isStoredValueOutsideList = value !== "" && !options.includes(value);

  return (
    <Label className="grid gap-1">
      <span>진도</span>
      <NativeSelect aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {value === "" ? <NativeSelectOption value="">진도 선택</NativeSelectOption> : null}
        {isStoredValueOutsideList ? (
          <NativeSelectOption value={value}>{value} (기존 값)</NativeSelectOption>
        ) : null}
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Label>
  );
}
