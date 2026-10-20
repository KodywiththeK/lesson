import { DateField } from "@/components/operations/date-time-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { BOOK_LIMITS } from "@/domain/book-stock";

import { formatQuantity } from "./book-format";
import {
  selectBook,
  type BookChoice,
  type BookShipmentValues,
  type StudentChoice,
} from "./book-shipment-values";

const FIELD_LABEL_CLASS_NAME = "grid gap-1 text-sm font-medium";

type BookShipmentFieldsProps = {
  values: BookShipmentValues;
  students: StudentChoice[];
  books: BookChoice[];
  onChange: (values: BookShipmentValues) => void;
};

/** 출고 등록 폼과 수정 다이얼로그가 같이 쓰는 입력 칸. 배치는 부모의 grid가 정한다. */
export function BookShipmentFields({ values, students, books, onChange }: BookShipmentFieldsProps) {
  function changeField<TField extends keyof BookShipmentValues>(field: TField, value: BookShipmentValues[TField]) {
    onChange({ ...values, [field]: value });
  }

  return (
    <>
      <Label className={FIELD_LABEL_CLASS_NAME}>
        <span>이름(원생)</span>
        <NativeSelect
          aria-label="이름(원생)"
          className="w-full"
          value={values.studentId}
          onChange={(event) => changeField("studentId", event.target.value)}
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
        <span>도서명</span>
        <NativeSelect
          aria-label="도서명"
          className="w-full"
          value={values.bookId}
          onChange={(event) => onChange(selectBook(values, event.target.value, books))}
        >
          <NativeSelectOption value="">도서를 선택하세요</NativeSelectOption>
          {books.map((book) => (
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
          value={values.price}
          onChange={(event) => changeField("price", event.target.value)}
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
          value={values.quantity}
          onChange={(event) => changeField("quantity", event.target.value)}
        />
      </Label>
      <Label className={FIELD_LABEL_CLASS_NAME}>
        <span>출고일</span>
        <DateField
          aria-label="출고일"
          required
          value={values.shippedOn}
          onValueChange={(shippedOn) => changeField("shippedOn", shippedOn)}
        />
      </Label>
    </>
  );
}

function formatBookChoiceLabel(book: BookChoice) {
  if (book.quantity === null) {
    return `${book.title} (보관된 교재)`;
  }

  return book.quantity === 0 ? `${book.title} (재고 없음)` : `${book.title} (남은 재고 ${formatQuantity(book.quantity)})`;
}
