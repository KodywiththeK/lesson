"use client";

import { useId, useState } from "react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { validatePaymentDate, type BookStockRow } from "@/domain/book-stock";
import { getFinanceToday } from "@/domain/finance-date";

import { BookShipmentFields } from "./book-shipment-fields";
import {
  buildBookChoices,
  createEmptyShipmentValues,
  toBookReleaseInput,
  validateShipmentValues,
  type BookReleaseRegistration,
  type StudentChoice,
} from "./book-shipment-values";

type BookShipmentFormProps = {
  students: StudentChoice[];
  books: BookStockRow[];
  /** 원장만 결제 상태를 고르고 바로 결제 완료로 등록할 수 있다. */
  canRecordPayment: boolean;
  isSubmitting: boolean;
  onSubmit: (registration: BookReleaseRegistration) => void;
};

type PaymentStatus = BookReleaseRegistration["status"];

/** 출고 등록 한 줄 폼(좁은 화면은 세로). 등록할 수 없을 때는 이유를 버튼 가까이에 보여 준다. */
export function BookShipmentForm({ students, books, canRecordPayment, isSubmitting, onSubmit }: BookShipmentFormProps) {
  const [values, setValues] = useState(() => createEmptyShipmentValues(getFinanceToday()));
  const [status, setStatus] = useState<PaymentStatus>("payment-pending");
  // 입금일을 고르기 전에는 출고일을 따라간다.
  const [chosenPaidOn, setChosenPaidOn] = useState<string | null>(null);
  const disabledReasonId = useId();
  const bookChoices = buildBookChoices(books);
  const paidOn = chosenPaidOn ?? values.shippedOn;
  const isPaid = status === "paid";
  const disabledReason =
    validateShipmentValues(values, { today: getFinanceToday(), books: bookChoices }) ??
    (isPaid ? validatePaymentDate(paidOn, values.shippedOn) : null);
  const canSubmit = disabledReason === null && !isSubmitting;

  function changeStatus(nextStatus: PaymentStatus) {
    setStatus(nextStatus);
    setChosenPaidOn(null);
  }

  return (
    <form
      aria-label="도서 구매 입력"
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({
          ...toBookReleaseInput(values),
          status,
          ...(isPaid ? { paidOn } : {}),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.4fr)_9rem_6rem_12rem_auto] lg:items-end">
        <BookShipmentFields values={values} students={students} books={bookChoices} onChange={setValues} />
        <Button
          type="submit"
          disabled={!canSubmit}
          aria-describedby={disabledReason ? disabledReasonId : undefined}
        >
          출고 등록
        </Button>
      </div>

      {canRecordPayment ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-lg">
          <Label className="grid gap-1 text-sm font-medium">
            <span>결제 상태</span>
            <NativeSelect
              aria-label="결제 상태"
              className="w-full"
              value={status}
              onChange={(event) => changeStatus(event.target.value as PaymentStatus)}
            >
              <NativeSelectOption value="payment-pending">결제 대기</NativeSelectOption>
              <NativeSelectOption value="paid">결제 완료</NativeSelectOption>
            </NativeSelect>
          </Label>
          {isPaid ? (
            <Label className="grid gap-1 text-sm font-medium">
              <span>입금일</span>
              <DateField aria-label="입금일" required value={paidOn} onValueChange={setChosenPaidOn} />
            </Label>
          ) : null}
        </div>
      ) : null}

      {disabledReason ? (
        <p id={disabledReasonId} className="text-sm text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}
