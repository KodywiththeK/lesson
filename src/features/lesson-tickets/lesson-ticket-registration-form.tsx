"use client";

import { useId, useState } from "react";

import { ListStatusAlert } from "@/components/management/list-controls";
import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  calculateLessonTicketValidUntil,
  MAX_LESSON_TICKET_VALID_DAYS,
} from "@/domain/lesson-ticket";
import { LEDGER_AMOUNT_MAX } from "@/domain/book-stock";
import { parseWonInput } from "@/domain/money-input";
import type {
  LessonTicketRegistrationStudentOption,
  RegisterLessonTicketInput,
} from "@/lib/api/lesson-tickets";
import { toUserMessage } from "@/lib/errors/user-message";

import { parseNumberInput } from "./parse-number-input";

const DEFAULT_GRANTED_COUNT = "4";
const DEFAULT_VALID_DAYS = "30";

type LessonTicketRegistrationFormProps = {
  academyId: string;
  today: string;
  options: LessonTicketRegistrationStudentOption[];
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
  canRecordPayment: boolean;
  onSubmit: (input: RegisterLessonTicketInput) => void;
};

export function LessonTicketRegistrationForm({
  academyId,
  today,
  options,
  isLoading,
  error,
  isSaving,
  canRecordPayment,
  onSubmit,
}: LessonTicketRegistrationFormProps) {
  const paidAmountHintId = useId();
  const [studentId, setStudentId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [grantedCountText, setGrantedCountText] = useState(DEFAULT_GRANTED_COUNT);
  const [validDaysText, setValidDaysText] = useState(DEFAULT_VALID_DAYS);
  const [registeredAt, setRegisteredAt] = useState(today);
  const [paidAmountText, setPaidAmountText] = useState("");
  const eligibleOptions = options.filter((option) => option.instruments.length > 0);
  const selectedStudent = eligibleOptions.find((option) => option.studentId === studentId);
  const selectedInstrument = selectedStudent?.instruments.find(
    (instrument) => instrument.instrumentId === instrumentId,
  );
  const grantedCount = parseNumberInput(grantedCountText);
  const validDays = parseNumberInput(validDaysText);
  const paidAmount = !canRecordPayment || paidAmountText === "" ? undefined : parseWonInput(paidAmountText);
  const hasValidGrantedCount = Number.isInteger(grantedCount) && grantedCount >= 1;
  const hasValidValidDays = Number.isInteger(validDays) && validDays >= 1 && validDays <= MAX_LESSON_TICKET_VALID_DAYS;
  const hasValidPaidAmount = paidAmount === undefined || (paidAmount !== null && paidAmount <= LEDGER_AMOUNT_MAX);
  const validUntil =
    hasValidValidDays && registeredAt
      ? calculateLessonTicketValidUntil(registeredAt, validDays)
      : undefined;
  const canSubmit =
    Boolean(selectedStudent) &&
    Boolean(selectedInstrument) &&
    hasValidGrantedCount &&
    Boolean(validUntil) &&
    hasValidPaidAmount &&
    !isSaving;

  return (
    <form
      aria-label="회차권 등록 입력"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!selectedInstrument || !canSubmit) {
          return;
        }

        onSubmit({
          academyId,
          studentId,
          instrumentId: selectedInstrument.instrumentId,
          instrumentName: selectedInstrument.instrumentName,
          grantedCount,
          validDays,
          registeredAt,
          ...(paidAmount == null ? {} : { paidAmount }),
        });
      }}
    >
      {error ? (
        <ListStatusAlert
          message="회차권 등록 선택지를 불러오지 못했습니다."
          detail={toUserMessage(error)}
        />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          회차권 등록 선택지를 불러오는 중입니다.
        </p>
      ) : null}

      <Label className="grid gap-1">
        <span>원생</span>
        <NativeSelect
          aria-label="원생"
          value={studentId}
          onChange={(event) => {
            const nextStudent = eligibleOptions.find((option) => option.studentId === event.target.value);

            setStudentId(event.target.value);
            // 악기가 하나뿐이면 선택 단계를 줄인다.
            setInstrumentId(
              nextStudent?.instruments.length === 1 ? nextStudent.instruments[0].instrumentId : "",
            );
          }}
        >
          <NativeSelectOption value="">원생 선택</NativeSelectOption>
          {eligibleOptions.map((option) => (
            <NativeSelectOption key={option.studentId} value={option.studentId}>
              {option.studentName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>

      <Label className="grid gap-1">
        <span>악기</span>
        <NativeSelect
          aria-label="악기"
          value={instrumentId}
          disabled={!selectedStudent}
          onChange={(event) => setInstrumentId(event.target.value)}
        >
          <NativeSelectOption value="">악기 선택</NativeSelectOption>
          {(selectedStudent?.instruments ?? []).map((instrument) => (
            <NativeSelectOption
              key={instrument.instrumentId}
              value={instrument.instrumentId}
            >
              {instrument.instrumentName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>부여 회수</span>
          <Input
            aria-label="부여 회수"
            type="number"
            min={1}
            step={1}
            value={grantedCountText}
            onChange={(event) => setGrantedCountText(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>사용 기한(일)</span>
          <Input
            aria-label="사용 기한(일)"
            type="number"
            min={1}
            max={MAX_LESSON_TICKET_VALID_DAYS}
            step={1}
            value={validDaysText}
            onChange={(event) => setValidDaysText(event.target.value)}
          />
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>등록일</span>
          <DateField
            aria-label="등록일"
            required
            value={registeredAt}
            onValueChange={setRegisteredAt}
          />
        </Label>
        <div className="self-end pb-2 text-sm text-muted-foreground">
          <p>{`입력 기준 만료일: ${validUntil ?? `사용 기한을 1~${MAX_LESSON_TICKET_VALID_DAYS}일로 입력해 주세요`}`}</p>
          <p>기존 회차권 만료일이 더 늦으면 그 날짜를 유지합니다.</p>
        </div>
      </div>

      {canRecordPayment ? <div className="grid gap-1">
        <Label className="grid gap-1">
          <span>결제 금액(선택)</span>
          <Input
            aria-label="결제 금액"
            aria-describedby={paidAmountHintId}
            type="text"
            inputMode="numeric"
            pattern="(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)"
            aria-invalid={!hasValidPaidAmount}
            value={paidAmountText}
            onChange={(event) => setPaidAmountText(event.target.value)}
          />
        </Label>
        <p id={paidAmountHintId} className="text-xs text-muted-foreground">
          입력하면 수입 내역에 기록됩니다(관리자만 입력 가능).
        </p>
        {!hasValidPaidAmount ? <p className="text-xs text-destructive">결제 금액은 0~{LEDGER_AMOUNT_MAX.toLocaleString("ko-KR")}원 사이의 정수로 입력해 주세요.</p> : null}
      </div> : null}

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          {isSaving ? "저장 중" : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}
