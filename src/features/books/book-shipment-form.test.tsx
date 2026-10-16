import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectWholeWonInput } from "@/test/expect-whole-won-input";

import { BookShipmentForm } from "./book-shipment-form";
import { testBooks, testStudents } from "./book-shipment-test-data";

function renderForm(props: Partial<ComponentProps<typeof BookShipmentForm>> = {}) {
  const onSubmit = vi.fn();
  render(
    <BookShipmentForm
      students={testStudents}
      books={testBooks}
      canRecordPayment={false}
      isSubmitting={false}
      onSubmit={onSubmit}
      {...props}
    />,
  );

  return { onSubmit, form: screen.getByRole("form", { name: "도서 구매 입력" }) };
}

async function fillValidRelease(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("이름(원생)"), "student-1");
  await user.selectOptions(screen.getByLabelText("도서명"), "book-1");
}

describe("BookShipmentForm", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("출고일은 오늘, 수량은 1권으로 시작하고 도서 선택지에 남은 재고를 보여 준다", () => {
    renderForm();

    expect(screen.getByLabelText("출고일")).toHaveValue("2026-10-15");
    expect(screen.getByLabelText("수량")).toHaveValue(1);
    expect(screen.getByRole("option", { name: "원생을 선택하세요" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "바이엘 상 (남은 재고 9권)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "체르니 100 (재고 없음)" })).toBeInTheDocument();
    expect(screen.queryByLabelText("결제 상태")).not.toBeInTheDocument();
  });

  it("도서를 고르면 가격이 자동 입력되고 고칠 수 있으며 도서를 바꾸면 다시 자동 입력된다", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("도서명"), "book-1");
    expect(screen.getByLabelText("가격(원)")).toHaveValue(12000);

    await user.clear(screen.getByLabelText("가격(원)"));
    await user.type(screen.getByLabelText("가격(원)"), "10000");
    expect(screen.getByLabelText("가격(원)")).toHaveValue(10000);

    await user.selectOptions(screen.getByLabelText("도서명"), "book-2");
    expect(screen.getByLabelText("가격(원)")).toHaveValue(18000);
  });

  it("가격은 1원 단위 양의 정수만 허용한다", () => {
    renderForm();

    expectWholeWonInput(screen.getByRole("spinbutton", { name: "가격(원)" }));
  });

  it("입력이 부족하면 등록을 막고 이유를 버튼과 연결해 알려 준다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const submit = screen.getByRole("button", { name: "출고 등록" });

    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription("재원 중인 원생을 선택해 주세요.");

    await user.selectOptions(screen.getByLabelText("이름(원생)"), "student-1");
    expect(submit).toHaveAccessibleDescription("도서를 선택해 주세요.");

    await user.selectOptions(screen.getByLabelText("도서명"), "book-1");
    expect(submit).toBeEnabled();
    expect(submit).not.toHaveAttribute("aria-describedby");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("재고가 없는 교재를 고르면 입고 후 출고하라고 안내한다", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("이름(원생)"), "student-1");
    await user.selectOptions(screen.getByLabelText("도서명"), "book-3");

    expect(screen.getByRole("button", { name: "출고 등록" })).toBeDisabled();
    expect(screen.getByText("재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.")).toBeInTheDocument();
  });

  it("남은 재고보다 많은 수량은 남은 재고를 알려 주며 막는다", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValidRelease(user);

    await user.selectOptions(screen.getByLabelText("도서명"), "book-2");
    await user.clear(screen.getByLabelText("수량"));
    await user.type(screen.getByLabelText("수량"), "5");

    expect(screen.getByRole("button", { name: "출고 등록" })).toBeDisabled();
    expect(screen.getByText("재고가 부족합니다. 남은 재고는 4권입니다.")).toBeInTheDocument();
  });

  it("출고일은 오늘 이후로 정할 수 없다", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValidRelease(user);

    await user.clear(screen.getByLabelText("출고일"));
    await user.type(screen.getByLabelText("출고일"), "2026-10-16");

    expect(screen.getByRole("button", { name: "출고 등록" })).toBeDisabled();
    expect(screen.getByText("출고일은 오늘 이후로 정할 수 없습니다.")).toBeInTheDocument();
  });

  it("데스크 등록은 결제 대기 출고로 보낸다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fillValidRelease(user);

    await user.clear(screen.getByLabelText("수량"));
    await user.type(screen.getByLabelText("수량"), "2");
    await user.click(screen.getByRole("button", { name: "출고 등록" }));

    expect(onSubmit).toHaveBeenCalledWith({
      studentId: "student-1",
      bookId: "book-1",
      price: 12000,
      quantity: 2,
      shippedOn: "2026-10-15",
      status: "payment-pending",
    });
  });

  it("원장은 결제 상태를 고를 수 있고 결제 완료를 고르면 출고일이 기본인 입금일을 입력한다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ canRecordPayment: true });
    await fillValidRelease(user);

    expect(screen.getByLabelText("결제 상태")).toHaveValue("payment-pending");
    expect(screen.queryByLabelText("입금일")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("결제 상태"), "paid");
    expect(screen.getByLabelText("입금일")).toHaveValue("2026-10-15");

    await user.clear(screen.getByLabelText("입금일"));
    await user.type(screen.getByLabelText("입금일"), "2026-10-20");
    await user.click(screen.getByRole("button", { name: "출고 등록" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid", paidOn: "2026-10-20", shippedOn: "2026-10-15" }),
    );
  });

  it("입금일은 출고일보다 이를 수 없다", async () => {
    const user = userEvent.setup();
    renderForm({ canRecordPayment: true });
    await fillValidRelease(user);
    await user.selectOptions(screen.getByLabelText("결제 상태"), "paid");

    await user.clear(screen.getByLabelText("입금일"));
    await user.type(screen.getByLabelText("입금일"), "2026-10-14");

    expect(screen.getByRole("button", { name: "출고 등록" })).toBeDisabled();
    expect(screen.getByText("입금일은 출고일(2026-10-15) 이후여야 합니다.")).toBeInTheDocument();
  });

  it("출고일을 바꾸면 기본 입금일도 같은 날로 따라간다", async () => {
    const user = userEvent.setup();
    renderForm({ canRecordPayment: true });
    await fillValidRelease(user);
    await user.selectOptions(screen.getByLabelText("결제 상태"), "paid");

    await user.clear(screen.getByLabelText("출고일"));
    await user.type(screen.getByLabelText("출고일"), "2026-10-10");

    expect(screen.getByLabelText("입금일")).toHaveValue("2026-10-10");
  });

  it("처리 중에는 등록 버튼을 막아 중복 등록을 막는다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ isSubmitting: true });
    await fillValidRelease(user);

    expect(screen.getByRole("button", { name: "출고 등록" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
