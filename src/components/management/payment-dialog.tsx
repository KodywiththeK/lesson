"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  calculateCardFee,
  getCardFeeAmountError,
  needsCardFeeChoice,
  parseCardFeeDraft,
  type CardFeeChoice,
  type CardFeeRate,
} from "@/domain/card-fee";
import { getFinanceToday } from "@/domain/finance-date";
import { TUITION_PAYMENT_METHODS, type TuitionPaymentMethod } from "@/domain/tuition-income";

import { CardFeeFields } from "./card-fee-fields";

const DEFAULT_PAYMENT_DESCRIPTION = "확인하면 연결된 입출입내역이 자동으로 기록됩니다.";

/** 고른 날짜에 맞춰 호출하는 쪽이 정하는 안내. `emphasized`면 눈에 띄게 보여 준다. */
/** 카드 입금이면 고른 카드사와 수수료도 넘긴다. 카드가 아니거나 카드사가 없으면 cardFee는 비어 있다. */
export type PaymentConfirmHandler = (paidAt: string, paymentMethod?: TuitionPaymentMethod, cardFee?: CardFeeChoice) => void;

type CardFeeProps = {
  /** 결제 금액. 알면 카드 수수료를 미리 계산해 보여 주고 고칠 수 있다. */
  amount?: number;
  /** 고를 수 있는 카드사. 비어 있으면 카드 입금도 수입만 기록한다. */
  cardFeeRates?: CardFeeRate[];
  /** 카드사 목록을 읽는 중이거나 읽지 못했다. 카드사 없음과 구분해 카드 입금을 막는다. */
  cardFeeRatesUnavailable?: boolean;
};

export type PaymentDateNotice = { message: string; emphasized?: boolean };

type PaymentDateRules = {
  /** 고른 날짜를 막아야 하면 이유 문구를, 통과하면 null을 돌려준다. 막히면 확인할 수 없다. */
  validateDate?: (date: string) => string | null;
  describeDate?: (date: string) => PaymentDateNotice | null;
};

export function PaymentDialog({
  amount,
  cardFeeRates,
  cardFeeRatesUnavailable,
  confirmLabel = "확인",
  contextMonth,
  dateLabel,
  description = DEFAULT_PAYMENT_DESCRIPTION,
  describeDate,
  initialDate,
  onConfirm,
  open,
  pending = false,
  requirePaymentMethod = false,
  title,
  validateDate,
  onOpenChange,
}: PaymentDateRules & CardFeeProps & {
  confirmLabel?: string;
  /** 지금 보고 있는 월(`YYYY-MM`). 고른 날짜가 이 월 밖이면 어느 월 내역으로 기록되는지 안내한다. */
  contextMonth?: string;
  dateLabel: string;
  description?: string;
  /** 처음 보일 날짜. 없으면 오늘이다. */
  initialDate?: string;
  onConfirm: PaymentConfirmHandler;
  open: boolean;
  pending?: boolean;
  requirePaymentMethod?: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <PaymentDateForm
          amount={amount}
          cardFeeRates={cardFeeRates}
          cardFeeRatesUnavailable={cardFeeRatesUnavailable}
          confirmLabel={confirmLabel}
          contextMonth={contextMonth}
          dateLabel={dateLabel}
          describeDate={describeDate}
          initialDate={initialDate}
          pending={pending}
          requirePaymentMethod={requirePaymentMethod}
          validateDate={validateDate}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** 다이얼로그가 열릴 때마다 새로 마운트되어 날짜가 항상 오늘(또는 initialDate)로 시작한다. */
export function PaymentDateForm({
  amount,
  cardFeeRates = [],
  cardFeeRatesUnavailable = false,
  confirmLabel,
  contextMonth,
  dateLabel,
  describeDate,
  initialDate,
  pending,
  requirePaymentMethod = false,
  validateDate,
  onConfirm,
  onCancel,
}: PaymentDateRules & CardFeeProps & {
  confirmLabel: string;
  contextMonth?: string;
  dateLabel: string;
  initialDate?: string;
  pending: boolean;
  requirePaymentMethod?: boolean;
  onConfirm: PaymentConfirmHandler;
  onCancel: () => void;
}) {
  const [paidAt, setPaidAt] = useState(() => initialDate ?? getFinanceToday());
  const [paymentMethod, setPaymentMethod] = useState<TuitionPaymentMethod | "">("");
  const [isDateDraftValid, setIsDateDraftValid] = useState(true);
  const [cardFeeRateId, setCardFeeRateId] = useState("");
  const [cardFeeDraft, setCardFeeDraft] = useState("");
  const showsCardFee = needsCardFeeChoice(paymentMethod || undefined, cardFeeRates.length);
  const cardFeeRate = showsCardFee ? cardFeeRates.find((rate) => rate.id === cardFeeRateId) : undefined;
  const cardFeeError = cardFeeRate && amount !== undefined ? getCardFeeAmountError(cardFeeDraft, amount) : null;
  const isCardFeeUnknown = paymentMethod === "card" && cardFeeRatesUnavailable;
  const isCardFeeIncomplete = isCardFeeUnknown || (showsCardFee && (!cardFeeRate || cardFeeError !== null));
  const cardFee: CardFeeChoice | undefined = cardFeeRate
    ? { rateId: cardFeeRate.id, ...(amount !== undefined ? { amount: parseCardFeeDraft(cardFeeDraft) ?? 0 } : {}) }
    : undefined;

  function changeCardFeeRate(rateId: string) {
    setCardFeeRateId(rateId);
    const rate = cardFeeRates.find((candidate) => candidate.id === rateId);
    setCardFeeDraft(rate && amount !== undefined ? String(calculateCardFee(amount, rate.ratePercent)) : "");
  }
  const isMissing = paidAt === "";
  const recordedMonth = paidAt.slice(0, 7);
  const showsOtherMonth = !isMissing && contextMonth !== undefined && recordedMonth !== contextMonth;
  const dateError = isMissing ? `${dateLabel}을 입력해 주세요.` : (validateDate?.(paidAt) ?? null);
  const dateNotice = isMissing ? null : (describeDate?.(paidAt) ?? null);

  return (
    <>
      <Label className="grid gap-1 text-sm font-medium">
        <span>{dateLabel}</span>
        <DateField
          aria-label={dateLabel}
          value={paidAt}
          onValueChange={setPaidAt}
          onValidityChange={setIsDateDraftValid}
        />
      </Label>
      {requirePaymentMethod ? <Label className="grid gap-1 text-sm font-medium">
        <span>결제 방식</span>
        <NativeSelect aria-label="결제 방식" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as TuitionPaymentMethod | "")}>
          <NativeSelectOption value="">결제 방식 선택</NativeSelectOption>
          {TUITION_PAYMENT_METHODS.map((method) => <NativeSelectOption key={method.value} value={method.value}>{method.label}</NativeSelectOption>)}
        </NativeSelect>
      </Label> : null}
      {isCardFeeUnknown ? (
        <p role="alert" className="text-sm text-destructive">
          카드사 목록을 확인하지 못했습니다. 잠시 후 다시 열어 주세요.
        </p>
      ) : null}
      {showsCardFee && !isCardFeeUnknown ? (
        <CardFeeFields
          rates={cardFeeRates}
          amount={amount}
          rateId={cardFeeRateId}
          feeDraft={cardFeeDraft}
          feeError={cardFeeError}
          onRateChange={changeCardFeeRate}
          onFeeChange={setCardFeeDraft}
        />
      ) : null}
      {dateError ? (
        <p role="alert" className="text-sm text-destructive">
          {dateError}
        </p>
      ) : null}
      {dateNotice ? (
        <p className={dateNotice.emphasized ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>
          {dateNotice.message}
        </p>
      ) : null}
      {showsOtherMonth ? (
        <p className="text-sm text-muted-foreground">
          {dateLabel}이 속한 {Number(recordedMonth.slice(5))}월 입출입내역으로 기록됩니다.
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          취소
        </Button>
        <Button type="button" disabled={pending || dateError !== null || !isDateDraftValid || (requirePaymentMethod && !paymentMethod) || isCardFeeIncomplete}
          onClick={() => requirePaymentMethod ? onConfirm(paidAt, paymentMethod || undefined, cardFee) : onConfirm(paidAt)}>
          {pending ? "처리 중" : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

/** 되돌리기 어렵거나 연결된 기록을 지우는 동작은 무엇이 일어나는지 알리고 한 번 더 확인받는다. */
export function FinanceConfirmDialog({
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
}: {
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending?: boolean;
  title: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "처리 중" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
