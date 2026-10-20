"use client";

import { useId, useState } from "react";

import { DateField, TimeField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { getFinanceToday } from "@/domain/finance-date";
import { parseWonInput } from "@/domain/money-input";
import type { TeacherPayType, TeacherWorkScheduleInput } from "@/domain/teacher";
import {
  buildTeacherPartFormOptions,
  formatTeacherPayType,
  type TeacherListRow,
} from "@/domain/teacher-list";
import {
  formatResidentRegistrationInput,
  validateResidentRegistration,
} from "@/domain/teacher-resident-registration";
import { getInitialSalaryState } from "@/domain/teacher-salary-form-state";
import type { TeacherProfileMutationInput } from "@/lib/api/teachers";

/** 등록·수정 폼이 내보내는 값. 급여·주민등록번호 항목은 원장 화면에서만 채워진다. */
export type TeacherFormInput = Omit<TeacherProfileMutationInput, "academyId" | "teacherId">;

const DEFAULT_PART = "피아노";

export const teacherPayTypeOptions: Array<{ value: TeacherPayType; label: string }> = [
  { value: "monthly", label: formatTeacherPayType("monthly") },
  { value: "hourly", label: formatTeacherPayType("hourly") },
  { value: "ratio", label: formatTeacherPayType("ratio") },
];

const weekdayOptions = [
  { value: "monday", label: "월" },
  { value: "tuesday", label: "화" },
  { value: "wednesday", label: "수" },
  { value: "thursday", label: "목" },
  { value: "friday", label: "금" },
  { value: "saturday", label: "토" },
  { value: "sunday", label: "일" },
];

export function toWeekdayLabel(value: string) {
  return weekdayOptions.find((weekday) => weekday.value === value)?.label ?? value;
}

type TeacherProfileFormProps = {
  initialTeacher?: TeacherListRow;
  submitLabel: string;
  isSubmitting: boolean;
  /** 급여 설정과 주민등록번호는 원장만 입력한다. 아니면 칸을 보여 주지 않고 값도 보내지 않는다. */
  isOwner: boolean;
  onSubmit: (input: TeacherFormInput) => void;
};

export function TeacherProfileForm({
  initialTeacher,
  submitLabel,
  isSubmitting,
  isOwner,
  onSubmit,
}: TeacherProfileFormProps) {
  const initialSalary = getInitialSalaryState(initialTeacher);
  const [name, setName] = useState(initialTeacher?.name ?? "");
  const [part, setPart] = useState(initialTeacher?.part ?? DEFAULT_PART);
  const [contact, setContact] = useState(initialTeacher?.contact ?? "");
  const [registeredAt, setRegisteredAt] = useState(
    initialTeacher?.registeredAt ?? getFinanceToday(),
  );
  const [contractStartOn, setContractStartOn] = useState(
    initialTeacher?.contractStartOn ?? "",
  );
  const [contractEndOn, setContractEndOn] = useState(
    initialTeacher?.contractEndOn ?? "",
  );
  const [payType, setPayType] = useState<TeacherPayType>(
    initialTeacher?.payType ?? "monthly",
  );
  const [monthlySalary, setMonthlySalary] = useState(initialSalary.monthlySalary);
  const [hourlyRate, setHourlyRate] = useState(initialSalary.hourlyRate);
  const [ratioAcademyShare, setRatioAcademyShare] = useState(
    initialSalary.ratioAcademyShare,
  );
  const [ratioTeacherShare, setRatioTeacherShare] = useState(
    initialSalary.ratioTeacherShare,
  );
  const [residentRegistration, setResidentRegistration] = useState("");
  const [isResidentRegistrationTouched, setIsResidentRegistrationTouched] = useState(false);
  const [workSchedules, setWorkSchedules] = useState(() =>
    buildInitialWorkScheduleState(initialTeacher),
  );
  // 소수 첫째 자리 비율(3.5 + 6.5)도 부동소수점 오차 없이 비교한다.
  const ratioTotal =
    Math.round((Number(ratioAcademyShare || 0) + Number(ratioTeacherShare || 0)) * 10) / 10;
  const residentRegistrationResult = residentRegistration
    ? validateResidentRegistration(residentRegistration)
    : undefined;
  const hasInvalidResidentRegistration = residentRegistrationResult?.ok === false;
  const salaryAmount = payType === "monthly" ? parseWonInput(monthlySalary) : parseWonInput(hourlyRate);
  const hasValidSalary = payType === "ratio" || (salaryAmount !== null && salaryAmount > 0);
  const canSubmit =
    Boolean(
      name.trim() &&
        part.trim() &&
        contact.trim() &&
        registeredAt &&
        contractStartOn &&
        contractEndOn,
    ) &&
    (!isOwner || payType !== "ratio" || ratioTotal === 10) &&
    (!isOwner || hasValidSalary) &&
    !hasInvalidResidentRegistration;

  function buildSubmitInput(): TeacherFormInput {
    const selectedSchedules = workSchedules
      .filter((schedule) => schedule.checked)
      .map(
        (schedule): TeacherWorkScheduleInput => ({
          weekday: schedule.weekday,
          ...(schedule.startTime ? { startTime: schedule.startTime } : {}),
          ...(schedule.endTime ? { endTime: schedule.endTime } : {}),
        }),
      );
    const profile: TeacherFormInput = {
      name: name.trim(),
      part: part.trim(),
      contact: contact.trim(),
      registeredAt,
      contractStartOn,
      contractEndOn,
      workSchedules: selectedSchedules,
    };

    if (!isOwner) {
      return profile;
    }

    return {
      ...profile,
      payType,
      monthlySalary: payType === "monthly" ? (parseWonInput(monthlySalary) ?? 0) : undefined,
      hourlyRate: payType === "hourly" ? (parseWonInput(hourlyRate) ?? 0) : undefined,
      ratioAcademyShare:
        payType === "ratio" ? Number(ratioAcademyShare || 0) : undefined,
      ratioTeacherShare:
        payType === "ratio" ? Number(ratioTeacherShare || 0) : undefined,
      ...(residentRegistrationResult?.ok
        ? { residentRegistration: residentRegistrationResult.normalized }
        : {}),
    };
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit(buildSubmitInput());
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>선생님명</span>
          <Input
            aria-label="선생님명"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>담당 파트</span>
          <NativeSelect
            aria-label="담당 파트"
            value={part}
            onChange={(event) => setPart(event.target.value)}
          >
            {buildTeacherPartFormOptions(initialTeacher?.part).map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>연락처</span>
          <Input
            aria-label="연락처"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>등록일</span>
          <DateField
            aria-label="등록일"
            value={registeredAt}
            onValueChange={setRegisteredAt}
          />
        </Label>
        {isOwner ? (
          <ResidentRegistrationInput
            value={residentRegistration}
            currentMasked={initialTeacher?.residentRegistrationMasked}
            errorMessage={
              residentRegistrationResult?.ok === false &&
              (isResidentRegistrationTouched || residentRegistrationResult.code !== "format")
                ? residentRegistrationResult.reason
                : undefined
            }
            onChange={(nextValue) => setResidentRegistration(formatResidentRegistrationInput(nextValue))}
            onBlur={() => setIsResidentRegistrationTouched(true)}
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>계약 시작일</span>
          <DateField
            aria-label="계약 시작일"
            value={contractStartOn}
            onValueChange={setContractStartOn}
          />
        </Label>
        <Label className="grid gap-1">
          <span>계약 종료일</span>
          <DateField
            aria-label="계약 종료일"
            value={contractEndOn}
            onValueChange={setContractEndOn}
          />
        </Label>
      </div>

      <div className="grid gap-3">
        <Label>출근 요일</Label>
        <div className="grid gap-2 rounded-md border border-border p-3">
          {workSchedules.map((schedule, index) => (
            <div
              key={schedule.weekday}
              className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr]"
            >
              <Label className="flex items-center gap-2">
                <Checkbox
                  aria-label={schedule.label}
                  checked={schedule.checked}
                  onCheckedChange={(checked) => {
                    setWorkSchedules((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, checked: checked === true }
                          : item,
                      ),
                    );
                  }}
                />
                <span>{schedule.label}</span>
              </Label>
              <TimeField
                aria-label={`${schedule.label} 시작 시간`}
                value={schedule.startTime}
                disabled={!schedule.checked}
                onValueChange={(nextValue) => {
                  setWorkSchedules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, startTime: nextValue }
                        : item,
                    ),
                  );
                }}
              />
              <TimeField
                aria-label={`${schedule.label} 종료 시간`}
                value={schedule.endTime}
                disabled={!schedule.checked}
                onValueChange={(nextValue) => {
                  setWorkSchedules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, endTime: nextValue }
                        : item,
                    ),
                  );
                }}
              />
            </div>
          ))}
        </div>
        {isOwner && payType === "hourly" ? (
          <p className="text-xs text-muted-foreground">
            시급제 급여는 시급 × 출근 요일·시간(계약 기간 안)으로 계산하므로 출근 시간까지 입력해 주세요.
          </p>
        ) : null}
      </div>

      {isOwner ? (
        <SalaryFields
          payType={payType}
          monthlySalary={monthlySalary}
          hourlyRate={hourlyRate}
          ratioAcademyShare={ratioAcademyShare}
          ratioTeacherShare={ratioTeacherShare}
          ratioTotal={ratioTotal}
          onPayTypeChange={setPayType}
          onMonthlySalaryChange={setMonthlySalary}
          onHourlyRateChange={setHourlyRate}
          onRatioAcademyShareChange={setRatioAcademyShare}
          onRatioTeacherShareChange={setRatioTeacherShare}
        />
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ResidentRegistrationInput({
  value,
  currentMasked,
  errorMessage,
  onChange,
  onBlur,
}: {
  value: string;
  currentMasked: string | undefined;
  errorMessage: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = [currentMasked ? hintId : undefined, errorMessage ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-1">
      <Label htmlFor={inputId}>주민등록번호</Label>
      <Input
        id={inputId}
        aria-label="주민등록번호"
        inputMode="numeric"
        autoComplete="off"
        placeholder="######-#######"
        value={value}
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {currentMasked ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          현재 {currentMasked} · 바꿀 때만 새로 입력해 주세요.
        </p>
      ) : null}
      {errorMessage ? (
        <p id={errorId} className="text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function SalaryFields({
  payType,
  monthlySalary,
  hourlyRate,
  ratioAcademyShare,
  ratioTeacherShare,
  ratioTotal,
  onPayTypeChange,
  onMonthlySalaryChange,
  onHourlyRateChange,
  onRatioAcademyShareChange,
  onRatioTeacherShareChange,
}: {
  payType: TeacherPayType;
  monthlySalary: string;
  hourlyRate: string;
  ratioAcademyShare: string;
  ratioTeacherShare: string;
  ratioTotal: number;
  onPayTypeChange: (payType: TeacherPayType) => void;
  onMonthlySalaryChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onRatioAcademyShareChange: (value: string) => void;
  onRatioTeacherShareChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <Label className="grid gap-1">
        <span>급여 형태</span>
        <NativeSelect
          aria-label="급여 형태"
          value={payType}
          onChange={(event) => onPayTypeChange(event.target.value as TeacherPayType)}
        >
          {teacherPayTypeOptions.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      {payType === "monthly" ? (
        <Label className="grid gap-1">
          <span>월급</span>
          <Input
            aria-label="월급"
            type="text"
            inputMode="numeric"
            value={monthlySalary}
            onChange={(event) => onMonthlySalaryChange(event.target.value)}
          />
        </Label>
      ) : null}
      {payType === "hourly" ? (
        <Label className="grid gap-1">
          <span>시급</span>
          <Input
            aria-label="시급"
            type="text"
            inputMode="numeric"
            value={hourlyRate}
            onChange={(event) => onHourlyRateChange(event.target.value)}
          />
        </Label>
      ) : null}
      {payType === "ratio" ? (
        <div className="grid gap-2">
          <Label>비율 설정 (학원 : 선생님, 합계 10)</Label>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Input
              aria-label="학원 몫"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={ratioAcademyShare}
              onChange={(event) => onRatioAcademyShareChange(event.target.value)}
            />
            <span className="text-muted-foreground">:</span>
            <Input
              aria-label="선생님 몫"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={ratioTeacherShare}
              onChange={(event) => onRatioTeacherShareChange(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">현재 합계 {ratioTotal}</p>
        </div>
      ) : null}
    </div>
  );
}

function buildInitialWorkScheduleState(teacher: TeacherListRow | undefined) {
  return weekdayOptions.map((weekday) => {
    const existing = teacher?.workSchedules?.find(
      (schedule) =>
        schedule.weekday === weekday.value ||
        schedule.weekdayLabel === weekday.label,
    );

    return {
      weekday: weekday.value,
      label: weekday.label,
      checked: Boolean(existing),
      startTime: existing?.startTime ?? "",
      endTime: existing?.endTime ?? "",
    };
  });
}
