"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BookShipmentRow } from "@/domain/book-sale";
import type { BookStockRow } from "@/domain/book-stock";
import { getFinanceToday } from "@/domain/finance-date";

import { BookShipmentFields } from "./book-shipment-fields";
import {
  buildBookChoices,
  buildStudentChoices,
  toBookReleaseInput,
  toShipmentValues,
  validateShipmentValues,
  type BookReleaseUpdate,
  type StudentChoice,
} from "./book-shipment-values";

type BookShipmentEditDialogProps = {
  /** 수정할 출고. 없으면 닫혀 있다. */
  shipment: BookShipmentRow | null;
  students: StudentChoice[];
  books: BookStockRow[];
  isSubmitting: boolean;
  onSubmit: (update: BookReleaseUpdate) => void;
  onClose: () => void;
};

/** 결제 대기 출고의 원생·도서·가격·수량·출고일을 고친다. 저장이 끝나기 전에는 닫히지 않는다. */
export function BookShipmentEditDialog({
  shipment,
  students,
  books,
  isSubmitting,
  onSubmit,
  onClose,
}: BookShipmentEditDialogProps) {
  return (
    <Dialog open={shipment !== null} onOpenChange={(open) => (open || isSubmitting ? undefined : onClose())}>
      {shipment ? (
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>출고 내역 수정</DialogTitle>
            <DialogDescription>
              원생·도서·가격·수량·출고일을 고칩니다. 도서나 수량을 바꾸면 재고가 함께 맞춰집니다.
            </DialogDescription>
          </DialogHeader>
          <BookShipmentEditForm
            key={shipment.saleId}
            shipment={shipment}
            students={students}
            books={books}
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function BookShipmentEditForm({
  shipment,
  students,
  books,
  isSubmitting,
  onSubmit,
  onCancel,
}: Omit<BookShipmentEditDialogProps, "shipment" | "onClose"> & {
  shipment: BookShipmentRow;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => toShipmentValues(shipment));
  const disabledReasonId = useId();
  const bookChoices = buildBookChoices(books, shipment);
  const disabledReason = validateShipmentValues(values, {
    today: getFinanceToday(),
    books: bookChoices,
    currentShipment: shipment,
  });
  const canSubmit = disabledReason === null && !isSubmitting;

  return (
    <form
      aria-label="출고 내역 수정 입력"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (canSubmit) {
          onSubmit({ releaseId: shipment.saleId, ...toBookReleaseInput(values) });
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <BookShipmentFields
          values={values}
          students={buildStudentChoices(students, shipment)}
          books={bookChoices}
          onChange={setValues}
        />
      </div>
      <DialogFooter className="items-center sm:justify-between">
        <p id={disabledReasonId} className="text-sm text-muted-foreground">
          {disabledReason}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            취소
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            aria-describedby={disabledReason ? disabledReasonId : undefined}
          >
            저장
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
