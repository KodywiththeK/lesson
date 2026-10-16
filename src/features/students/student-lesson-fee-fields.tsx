import { MonthField } from "@/components/operations/date-time-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  describeManualLessonFee,
  getLessonFeeSubmission,
  repriceLessonFee,
  setLessonFeeManually,
  type LessonFeeContext,
  type LessonFeeDraft,
} from "@/domain/lesson-fee-draft";
import {
  calculateLessonFee,
  getProgressOptions,
  PRIVATE_LESSON_MINUTE_OPTIONS,
  PRIVATE_LESSON_SESSION_OPTIONS,
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
    minutes: draft.minutes,
  });
  const submission = getLessonFeeSubmission(draft, referenceMonth);
  const isPrivateLesson = context.lessonType === "private";
  const feeNoticeId = `${labelPrefix}lesson-fee-notice`.replace(/\s+/g, "-");
  const isFeeReadOnly =
    priceResult.status === "priced" ||
    (priceResult.status === "manual" && priceResult.reason === "no-weekdays");

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
              <NativeSelect
                aria-label={withPrefix("월 횟수")}
                value={String(draft.sessionsPerMonth)}
                onChange={(event) =>
                  updatePricingInput({
                    sessionsPerMonth: Number(event.target.value) as LessonFeeDraft["sessionsPerMonth"],
                  })
                }
              >
                {PRIVATE_LESSON_SESSION_OPTIONS.map((sessions) => (
                  <NativeSelectOption key={sessions} value={sessions}>
                    월 {sessions}회
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Label>
            <Label className="grid gap-1">
              <span>수업 시간</span>
              <NativeSelect
                aria-label={withPrefix("수업 시간")}
                value={String(draft.minutes)}
                onChange={(event) =>
                  updatePricingInput({
                    minutes: Number(event.target.value) as LessonFeeDraft["minutes"],
                  })
                }
              >
                {PRIVATE_LESSON_MINUTE_OPTIONS.map((minutes) => (
                  <NativeSelectOption key={minutes} value={minutes}>
                    {minutes}분
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Label>
          </>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>레슨비</span>
          <Input
            aria-label={withPrefix("레슨비")}
            aria-describedby={feeNoticeId}
            min={0}
            step={1}
            type="number"
            readOnly={isFeeReadOnly}
            value={draft.lessonFee}
            onChange={(event) => onChange(setLessonFeeManually(draft, Number(event.target.value)))}
          />
        </Label>
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
          ? `저장된 레슨비가 가격표(${priceResult.fee.toLocaleString("ko-KR")}원)와 다릅니다. 진도나 요일을 바꾸면 가격표 금액으로 다시 계산합니다.`
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

      {draft.otherDiscount.amount > 0 ? (
        <Label className="grid max-w-xs gap-1">
          <span>{draft.otherDiscount.label} (매달, 이전에 입력한 금액)</span>
          <Input
            aria-label={withPrefix("기존 할인액")}
            min={0}
            step={1}
            type="number"
            value={draft.otherDiscount.amount}
            onChange={(event) =>
              onChange({
                ...draft,
                otherDiscount: { ...draft.otherDiscount, amount: Number(event.target.value) },
              })
            }
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
