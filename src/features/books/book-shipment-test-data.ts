import type { BookSale } from "@/domain/book-sale";
import type { BookStockRow } from "@/domain/book-stock";
import type { StudentListRow } from "@/domain/student-list";

/** 출고·결제 완료 화면 테스트가 같이 쓰는 결정적 fixture. */
export const TEST_ACADEMY_ID = "academy-1";

function student(studentId: string, name: string): StudentListRow {
  return {
    academyId: TEST_ACADEMY_ID,
    studentId,
    name,
    teacherNames: [],
    instrumentNames: [],
    weekdayLabels: [],
  };
}

export const testStudents: StudentListRow[] = [student("student-1", "김민지"), student("student-2", "이서윤")];

function book(bookId: string, title: string, price: number, quantity: number): BookStockRow {
  return { academyId: TEST_ACADEMY_ID, bookId, title, price, quantity, stockedOn: "2026-08-01" };
}

export const testBooks: BookStockRow[] = [
  book("book-1", "바이엘 상", 12000, 9),
  book("book-2", "스즈키 바이올린 1", 18000, 4),
  book("book-3", "체르니 100", 15000, 0),
];

function pendingSale(
  saleId: string,
  bookId: string,
  bookTitle: string,
  studentId: string | null,
  studentName: string,
  price: number,
  quantity: number,
  shippedAt: string,
): BookSale {
  return {
    academyId: TEST_ACADEMY_ID,
    saleId,
    bookId,
    bookTitle,
    studentId,
    studentName,
    price,
    quantity,
    shippedAt,
    status: "payment-pending",
  };
}

export const testPendingSales: BookSale[] = [
  pendingSale("sale-1", "book-1", "바이엘 상", "student-1", "김민지", 12000, 2, "2026-10-01"),
  pendingSale("sale-2", "book-2", "스즈키 바이올린 1", "student-2", "이서윤", 18000, 1, "2026-10-05"),
  pendingSale("sale-3", "book-3", "체르니 100", null, "박지우", 15000, 3, "2026-10-03"),
];

export const testPaidSales: BookSale[] = [
  {
    ...pendingSale("sale-10", "book-2", "스즈키 바이올린 1", "student-2", "이서윤", 18000, 2, "2026-10-02"),
    status: "paid",
    paidAt: "2026-10-14",
    paidLedgerEntryId: "ledger-10",
    permanent: true,
  },
  {
    ...pendingSale("sale-11", "book-1", "바이엘 상", "student-1", "김민지", 12000, 1, "2026-10-04"),
    status: "paid",
    paidAt: "2026-10-12",
    paidLedgerEntryId: null,
    permanent: true,
  },
];
