import { useId, useState, type ReactNode } from "react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BOOK_LIMITS, type BookStockInput, type BookStockRow } from "@/domain/book-stock";
import { getFinanceToday } from "@/domain/finance-date";

import {
  createEmptyBookStockFormValues,
  evaluateBookStockForm,
  toBookStockFormValues,
  type BookStockFormValues,
} from "./book-stock-form-state";

type BookStockFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 있으면 다이얼로그를 여는 버튼으로 쓴다. 없으면 `open`으로만 제어한다. */
  trigger?: ReactNode;
  academyId: string;
  /** 보관하지 않은 교재 전체. 재입고 미리보기와 도서명 중복 검사에 쓴다. */
  books: BookStockRow[];
  /** 수정할 교재. 없으면 새 교재 등록이다. */
  book?: BookStockRow;
  isSubmitting: boolean;
  onSubmit: (input: BookStockInput) => void;
};

/** 교재 등록과 수정이 같은 입력 항목을 쓰도록 한 다이얼로그로 둔다. */
export function BookStockFormDialog({
  open,
  onOpenChange,
  trigger,
  academyId,
  books,
  book,
  isSubmitting,
  onSubmit,
}: BookStockFormDialogProps) {
  const title = book ? "교재 수정" : "교재 등록";

  return (
    // 저장하는 동안 닫히면 결과를 확인하지 못하므로 처리 중에는 닫지 않는다.
    <Dialog open={open} onOpenChange={(next) => (isSubmitting ? undefined : onOpenChange(next))}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {book
              ? `${book.title} 교재의 정보와 현재 재고를 수정합니다.`
              : "새로운 교재를 입고하고 재고 목록에 등록합니다."}
          </DialogDescription>
        </DialogHeader>
        <BookStockForm
          formLabel={`${title} 입력`}
          submitLabel={book ? "수정" : "등록"}
          academyId={academyId}
          books={books}
          book={book}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function BookStockForm({
  formLabel,
  submitLabel,
  academyId,
  books,
  book,
  isSubmitting,
  onSubmit,
}: {
  formLabel: string;
  submitLabel: string;
  academyId: string;
  books: BookStockRow[];
  book?: BookStockRow;
  isSubmitting: boolean;
  onSubmit: (input: BookStockInput) => void;
}) {
  const [values, setValues] = useState<BookStockFormValues>(() =>
    book ? toBookStockFormValues(book) : createEmptyBookStockFormValues(getFinanceToday()),
  );
  const blockReasonId = useId();
  const { input, restockNotice, blockReason } = evaluateBookStockForm(values, {
    academyId,
    books,
    today: getFinanceToday(),
    editingBookId: book?.bookId,
  });
  const canSubmit = blockReason === null && !isSubmitting;

  function changeField<TField extends keyof BookStockFormValues>(field: TField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      aria-label={formLabel}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (canSubmit) {
          onSubmit(input);
        }
      }}
    >
      <Label className="grid gap-1">
        <span>도서명</span>
        <Input
          aria-label="도서명"
          aria-required
          maxLength={BOOK_LIMITS.titleMaxLength}
          placeholder="도서명 입력"
          value={values.title}
          onChange={(event) => changeField("title", event.target.value)}
        />
      </Label>

      {restockNotice ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {restockNotice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label className="grid gap-1">
            <span>가격(원)</span>
            <Input
              aria-label="가격(원)"
              aria-required
              type="text"
              inputMode="numeric"
              value={values.price}
              onChange={(event) => changeField("price", event.target.value)}
            />
          </Label>
          {book ? (
            <p className="text-sm text-muted-foreground">이미 출고된 건에는 반영되지 않습니다.</p>
          ) : null}
        </div>
        <Label className="grid gap-1 sm:self-start">
          <span>권수</span>
          <Input
            aria-label="권수"
            aria-required
            type="number"
            inputMode="numeric"
            min={0}
            max={BOOK_LIMITS.stockQuantityMax}
            step={1}
            value={values.quantity}
            onChange={(event) => changeField("quantity", event.target.value)}
          />
        </Label>
      </div>

      <Label className="grid gap-1">
        <span>입고일</span>
        <DateField
          aria-label="입고일"
          required
          value={values.stockedOn}
          onValueChange={(stockedOn) => changeField("stockedOn", stockedOn)}
        />
      </Label>

      <Label className="grid gap-1">
        <span>구입 거래처명 (선택)</span>
        <Input
          aria-label="구입 거래처명 (선택)"
          maxLength={BOOK_LIMITS.purchaseVendorMaxLength}
          placeholder="예: 예음문구"
          value={values.purchaseVendorName}
          onChange={(event) => changeField("purchaseVendorName", event.target.value)}
        />
      </Label>

      <DialogFooter className="items-center sm:justify-between">
        <p id={blockReasonId} className="text-sm text-muted-foreground">
          {blockReason}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              취소
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={!canSubmit}
            aria-describedby={blockReason === null ? undefined : blockReasonId}
          >
            {submitLabel}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
