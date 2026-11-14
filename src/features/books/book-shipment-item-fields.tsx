import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { BOOK_LIMITS } from "@/domain/book-stock";

import { formatBookChoiceLabel } from "./book-shipment-fields";
import { selectBook, type BookChoice, type BookShipmentItemValues } from "./book-shipment-values";

const FIELD_LABEL_CLASS_NAME = "grid gap-1 text-sm font-medium";

type BookShipmentItemFieldsProps = {
  /** 1부터 세는 줄 번호. 묶음 안에서 줄을 구분하는 이름으로 쓴다. */
  position: number;
  item: BookShipmentItemValues;
  books: BookChoice[];
  /** 다른 줄에서 이미 고른 도서. 같은 도서를 두 번 고르지 않도록 선택지에서 뺀다. */
  takenBookIds: ReadonlySet<string>;
  /** 줄이 하나뿐일 때는 지울 수 없다. */
  canRemove: boolean;
  /** 방금 추가한 줄이면 도서 선택에 포커스를 둔다. */
  autoFocusBook?: boolean;
  onChange: (item: BookShipmentItemValues) => void;
  onRemove: () => void;
};

/** 일괄 출고 폼의 도서 한 줄(도서명·가격·수량). 원생·출고일은 묶음 전체가 공유하므로 여기에 없다. */
export function BookShipmentItemFields({
  position,
  item,
  books,
  takenBookIds,
  canRemove,
  autoFocusBook = false,
  onChange,
  onRemove,
}: BookShipmentItemFieldsProps) {
  const selectableBooks = books.filter((book) => book.bookId === item.bookId || !takenBookIds.has(book.bookId));

  return (
    <fieldset className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_6rem_auto] sm:items-end">
      <legend className="mb-2 text-sm font-semibold">{`도서 ${position}`}</legend>
      <Label className={FIELD_LABEL_CLASS_NAME}>
        <span>도서명</span>
        <NativeSelect
          aria-label="도서명"
          autoFocus={autoFocusBook}
          className="w-full"
          value={item.bookId}
          onChange={(event) => onChange(selectBook(item, event.target.value, books))}
        >
          <NativeSelectOption value="">도서를 선택하세요</NativeSelectOption>
          {selectableBooks.map((book) => (
            <NativeSelectOption key={book.bookId} value={book.bookId}>
              {formatBookChoiceLabel(book)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <Label className={FIELD_LABEL_CLASS_NAME}>
        <span>가격(원)</span>
        <Input
          aria-label="가격(원)"
          type="text"
          inputMode="numeric"
          value={item.price}
          onChange={(event) => onChange({ ...item, price: event.target.value })}
        />
      </Label>
      <Label className={FIELD_LABEL_CLASS_NAME}>
        <span>수량</span>
        <Input
          aria-label="수량"
          type="number"
          min={1}
          max={BOOK_LIMITS.releaseQuantityMax}
          step={1}
          value={item.quantity}
          onChange={(event) => onChange({ ...item, quantity: event.target.value })}
        />
      </Label>
      {canRemove ? (
        <Button type="button" variant="outline" size="icon" aria-label={`도서 ${position} 삭제`} onClick={onRemove}>
          <X aria-hidden="true" />
        </Button>
      ) : (
        <span aria-hidden="true" className="hidden size-10 sm:block" />
      )}
    </fieldset>
  );
}
