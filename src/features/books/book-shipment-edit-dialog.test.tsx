import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookShipmentRow } from "@/domain/book-sale";

import { BookShipmentEditDialog } from "./book-shipment-edit-dialog";
import { testBooks, testStudents } from "./book-shipment-test-data";

const shipment: BookShipmentRow = {
  saleId: "sale-1",
  bookId: "book-1",
  studentId: "student-1",
  studentName: "김민지",
  bookTitle: "바이엘 상",
  price: 12000,
  quantity: 2,
  amount: 24000,
  shippedAt: "2026-10-01",
};

function renderDialog(
  props: Partial<ComponentProps<typeof BookShipmentEditDialog>> & { shipment?: BookShipmentRow } = {},
) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <BookShipmentEditDialog
      shipment={shipment}
      students={testStudents}
      books={testBooks}
      isSubmitting={false}
      onSubmit={onSubmit}
      onClose={onClose}
      {...props}
    />,
  );

  return { onSubmit, onClose, dialog: screen.getByRole("dialog", { name: "출고 내역 수정" }) };
}

describe("BookShipmentEditDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("현재 출고 내용으로 시작하고 고친 값을 출고 id와 함께 저장한다", async () => {
    const user = userEvent.setup();
    const { dialog, onSubmit } = renderDialog();

    expect(within(dialog).getByLabelText("이름(원생)")).toHaveValue("student-1");
    expect(within(dialog).getByLabelText("도서명")).toHaveValue("book-1");
    expect(within(dialog).getByLabelText("가격(원)")).toHaveValue("12000");
    expect(within(dialog).getByLabelText("수량")).toHaveValue(2);
    expect(within(dialog).getByLabelText("출고일")).toHaveValue("2026-10-01");

    await user.clear(within(dialog).getByLabelText("수량"));
    await user.type(within(dialog).getByLabelText("수량"), "3");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith({
      releaseId: "sale-1",
      studentId: "student-1",
      bookId: "book-1",
      price: 12000,
      quantity: 3,
      shippedOn: "2026-10-01",
    });
  });

  it("같은 도서에서 수량만 바꿀 때는 현재 재고에 기존 수량을 더한 만큼까지 허용한다", async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.clear(within(dialog).getByLabelText("수량"));
    await user.type(within(dialog).getByLabelText("수량"), "11");
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();

    await user.clear(within(dialog).getByLabelText("수량"));
    await user.type(within(dialog).getByLabelText("수량"), "12");
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    expect(within(dialog).getByText("재고가 부족합니다. 남은 재고는 11권입니다.")).toBeInTheDocument();
  });

  it("재고가 0권이어도 같은 도서의 수량을 줄이는 수정은 막지 않는다", async () => {
    const user = userEvent.setup();
    const outOfStockShipment = { ...shipment, bookId: "book-3", bookTitle: "체르니 100", price: 15000, quantity: 3 };
    const { dialog } = renderDialog({ shipment: outOfStockShipment });

    await user.clear(within(dialog).getByLabelText("수량"));
    await user.type(within(dialog).getByLabelText("수량"), "2");

    expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("도서를 바꾸면 가격이 다시 자동 입력되고 새 도서의 재고로 사전 검증한다", async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.selectOptions(within(dialog).getByLabelText("도서명"), "book-2");
    expect(within(dialog).getByLabelText("가격(원)")).toHaveValue("18000");
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();

    await user.clear(within(dialog).getByLabelText("수량"));
    await user.type(within(dialog).getByLabelText("수량"), "5");
    expect(within(dialog).getByText("재고가 부족합니다. 남은 재고는 4권입니다.")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("도서명"), "book-3");
    expect(within(dialog).getByText("재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.")).toBeInTheDocument();
  });

  it("이미 삭제(보관)된 교재의 출고는 그 도서만 현재 선택으로 남기고 다른 보관 교재는 보이지 않는다", async () => {
    const user = userEvent.setup();
    const archivedShipment = { ...shipment, bookId: "book-9", bookTitle: "보관된 체르니 30", price: 9000, quantity: 2 };
    const { dialog, onSubmit } = renderDialog({ shipment: archivedShipment });
    const bookSelect = within(dialog).getByLabelText("도서명");

    expect(bookSelect).toHaveValue("book-9");
    expect(within(bookSelect).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "도서를 선택하세요",
      "보관된 체르니 30 (보관된 교재)",
      "바이엘 상 (남은 재고 9권)",
      "스즈키 바이올린 1 (남은 재고 4권)",
      "체르니 100 (재고 없음)",
    ]);

    // 현재 재고를 알 수 없으므로 수량 사전 검증은 서버에 맡기고 같은 도서를 유지한 채 수정할 수 있다.
    await user.clear(within(dialog).getByLabelText("수량"));
    await user.type(within(dialog).getByLabelText("수량"), "5");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: "book-9", quantity: 5, price: 9000 }),
    );
  });

  it("휴원·퇴원해 선택지에 없는 현재 원생도 그대로 선택된 채 수정할 수 있다", async () => {
    const user = userEvent.setup();
    const { dialog, onSubmit } = renderDialog({
      shipment: { ...shipment, studentId: "student-9", studentName: "최휴원" },
    });

    expect(within(dialog).getByLabelText("이름(원생)")).toHaveValue("student-9");
    expect(within(dialog).getByRole("option", { name: "최휴원" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ studentId: "student-9" }));
  });

  it("원생 삭제로 연결이 끊긴 출고는 재원 원생을 다시 골라야 저장할 수 있다", async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog({ shipment: { ...shipment, studentId: null, studentName: "박지우" } });

    expect(within(dialog).getByLabelText("이름(원생)")).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    expect(within(dialog).getByText("재원 중인 원생을 선택해 주세요.")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("이름(원생)"), "student-2");

    expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("처리 중에는 저장과 취소를 막는다", () => {
    const { dialog } = renderDialog({ isSubmitting: true });

    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "취소" })).toBeDisabled();
  });

  it("취소하면 저장하지 않고 닫는다", async () => {
    const user = userEvent.setup();
    const { dialog, onClose, onSubmit } = renderDialog();

    await user.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
