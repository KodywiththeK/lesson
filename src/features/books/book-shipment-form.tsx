"use client";

import { Plus } from "lucide-react";
import { useId, useRef, useState } from "react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { validatePaymentDate, type BookStockRow } from "@/domain/book-stock";
import { getFinanceToday } from "@/domain/finance-date";

import { BookShipmentItemFields } from "./book-shipment-item-fields";
import {
  buildBookChoices,
  createEmptyShipmentBatchValues,
  createEmptyShipmentItem,
  toBookReleaseBatchInput,
  validateShipmentBatchValues,
  type BookReleaseBatchRegistration,
  type BookShipmentItemValues,
  type StudentChoice,
} from "./book-shipment-values";

type BookShipmentFormProps = {
  students: StudentChoice[];
  books: BookStockRow[];
  /** 원장만 결제 상태를 고르고 바로 결제 완료로 등록할 수 있다. */
  canRecordPayment: boolean;
  isSubmitting: boolean;
  onSubmit: (registration: BookReleaseBatchRegistration) => void;
};

type PaymentStatus = BookReleaseBatchRegistration["status"];

const FIELD_LABEL_CLASS_NAME = "grid gap-1 text-sm font-medium";

/**
 * 출고 등록 폼. 원생 한 명을 고르고 도서 줄을 필요한 만큼 추가해 한 번에 등록한다.
 * 출고일과 결제 상태·입금일은 묶음 전체에 한 번 적용한다. 등록할 수 없을 때는 이유를 버튼 가까이에 보여 준다.
 */
export function BookShipmentForm({ students, books, canRecordPayment, isSubmitting, onSubmit }: BookShipmentFormProps) {
  const nextItemNumber = useRef(1);
  const addItemButtonRef = useRef<HTMLButtonElement>(null);
  /** 방금 추가한 줄. 그 줄의 도서 선택으로 포커스를 옮긴다. */
  const [addedItemKey, setAddedItemKey] = useState<string | null>(null);
  const [values, setValues] = useState(() => createEmptyShipmentBatchValues(getFinanceToday(), "item-0"));
  const [status, setStatus] = useState<PaymentStatus>("payment-pending");
  // 입금일을 고르기 전에는 출고일을 따라간다.
  const [chosenPaidOn, setChosenPaidOn] = useState<string | null>(null);
  const disabledReasonId = useId();
  const bookChoices = buildBookChoices(books);
  const paidOn = chosenPaidOn ?? values.shippedOn;
  const isPaid = status === "paid";
  const disabledReason =
    validateShipmentBatchValues(values, { today: getFinanceToday(), books: bookChoices }) ??
    (isPaid ? validatePaymentDate(paidOn, values.shippedOn) : null);
  const canSubmit = disabledReason === null && !isSubmitting;

  function changeStatus(nextStatus: PaymentStatus) {
    setStatus(nextStatus);
    setChosenPaidOn(null);
  }

  function changeItem(index: number, nextItem: BookShipmentItemValues) {
    setValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
    }));
  }

  function addItem() {
    const key = `item-${nextItemNumber.current}`;
    nextItemNumber.current += 1;
    setValues((current) => ({ ...current, items: [...current.items, createEmptyShipmentItem(key)] }));
    setAddedItemKey(key);
  }

  function removeItem(index: number) {
    setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
    // 지운 줄의 버튼이 사라져 포커스를 잃지 않도록 도서 추가 버튼으로 옮긴다.
    addItemButtonRef.current?.focus();
  }

  return (
    <form
      aria-label="도서 구매 입력"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({
          ...toBookReleaseBatchInput(values),
          status,
          ...(isPaid ? { paidOn } : {}),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Label className={FIELD_LABEL_CLASS_NAME}>
          <span>이름(원생)</span>
          <NativeSelect
            aria-label="이름(원생)"
            className="w-full"
            value={values.studentId}
            onChange={(event) => setValues((current) => ({ ...current, studentId: event.target.value }))}
          >
            <NativeSelectOption value="">원생을 선택하세요</NativeSelectOption>
            {students.map((student) => (
              <NativeSelectOption key={student.studentId} value={student.studentId}>
                {student.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className={FIELD_LABEL_CLASS_NAME}>
          <span>출고일</span>
          <DateField
            aria-label="출고일"
            required
            value={values.shippedOn}
            onValueChange={(shippedOn) => setValues((current) => ({ ...current, shippedOn }))}
          />
        </Label>
      </div>

      <div className="grid gap-4">
        {values.items.map((item, index) => (
          <BookShipmentItemFields
            key={item.key}
            position={index + 1}
            item={item}
            books={bookChoices}
            takenBookIds={new Set(values.items.filter((other) => other !== item).map((other) => other.bookId))}
            canRemove={values.items.length > 1}
            autoFocusBook={item.key === addedItemKey}
            onChange={(nextItem) => changeItem(index, nextItem)}
            onRemove={() => removeItem(index)}
          />
        ))}
        <div>
          <Button ref={addItemButtonRef} type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus aria-hidden="true" />
            도서 추가
          </Button>
        </div>
      </div>

      {canRecordPayment ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-lg">
          <Label className={FIELD_LABEL_CLASS_NAME}>
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
            <Label className={FIELD_LABEL_CLASS_NAME}>
              <span>입금일</span>
              <DateField aria-label="입금일" required value={paidOn} onValueChange={setChosenPaidOn} />
            </Label>
          ) : null}
        </div>
      ) : null}

      <div className="grid justify-items-start gap-2">
        <Button type="submit" disabled={!canSubmit} aria-describedby={disabledReason ? disabledReasonId : undefined}>
          출고 등록
        </Button>
        {disabledReason ? (
          <p id={disabledReasonId} className="text-sm text-muted-foreground">
            {disabledReason}
          </p>
        ) : null}
      </div>
    </form>
  );
}
