import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("도서 선택지는 이름 속 숫자를 크기 순으로 정렬한다(1, 2, … 10, 11)", () => {
    const series = ["계이름 여행 10", "계이름 여행 2", "계이름 여행 12", "계이름 여행 1", "계이름 여행 11"];
    renderForm({
      books: series.map((title, index) => ({
        academyId: "academy-1",
        bookId: `series-${index}`,
        title,
        price: 10000,
        quantity: 2,
        stockedOn: "2026-08-01",
      })),
    });

    const labels = within(screen.getByLabelText("도서명"))
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(labels).toEqual([
      "도서를 선택하세요",
      "계이름 여행 1 (남은 재고 2권)",
      "계이름 여행 2 (남은 재고 2권)",
      "계이름 여행 10 (남은 재고 2권)",
      "계이름 여행 11 (남은 재고 2권)",
      "계이름 여행 12 (남은 재고 2권)",
    ]);
  });

  it("도서를 고르면 가격이 자동 입력되고 고칠 수 있으며 도서를 바꾸면 다시 자동 입력된다", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("도서명"), "book-1");
    expect(screen.getByLabelText("가격(원)")).toHaveValue("12000");

    await user.clear(screen.getByLabelText("가격(원)"));
    await user.type(screen.getByLabelText("가격(원)"), "10000");
    expect(screen.getByLabelText("가격(원)")).toHaveValue("10000");

    await user.selectOptions(screen.getByLabelText("도서명"), "book-2");
    expect(screen.getByLabelText("가격(원)")).toHaveValue("18000");
  });

  it("쉼표 금액을 입력해도 정확한 가격으로 출고 등록한다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fillValidRelease(user);

    await user.clear(screen.getByLabelText("가격(원)"));
    await user.type(screen.getByLabelText("가격(원)"), "140,000");
    expect(screen.getByLabelText("가격(원)")).toHaveValue("140,000");
    await user.click(screen.getByRole("button", { name: "출고 등록" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ price: 140000 })] }),
    );
  });

  it("가격은 텍스트 입력을 유지하고 유효성은 폼에서 검사한다", () => {
    renderForm();
    expect(screen.getByRole("textbox", { name: "가격(원)" })).toHaveAttribute("inputmode", "numeric");
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
      shippedOn: "2026-10-15",
      items: [{ bookId: "book-1", price: 12000, quantity: 2 }],
      status: "payment-pending",
    });
  });

  describe("여러 도서 일괄 출고", () => {
    async function addSecondBook(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: "도서 추가" }));
      return screen.getByRole("group", { name: "도서 2" });
    }

    it("처음에는 도서 한 줄로 시작하고 한 줄뿐일 때는 삭제 버튼이 없다", () => {
      renderForm();

      expect(screen.getByRole("group", { name: "도서 1" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "도서 2" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /도서 \d 삭제/ })).not.toBeInTheDocument();
    });

    it("도서 추가를 누르면 줄이 늘고, 줄마다 도서·가격·수량을 따로 입력한다", async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderForm();
      await fillValidRelease(user);
      const second = await addSecondBook(user);

      await user.selectOptions(within(second).getByLabelText("도서명"), "book-2");
      expect(within(second).getByLabelText("가격(원)")).toHaveValue("18000");
      await user.clear(within(second).getByLabelText("수량"));
      await user.type(within(second).getByLabelText("수량"), "2");
      await user.click(screen.getByRole("button", { name: "출고 등록" }));

      expect(onSubmit).toHaveBeenCalledWith({
        studentId: "student-1",
        shippedOn: "2026-10-15",
        items: [
          { bookId: "book-1", price: 12000, quantity: 1 },
          { bookId: "book-2", price: 18000, quantity: 2 },
        ],
        status: "payment-pending",
      });
    });

    it("다른 줄에서 이미 고른 도서는 선택지에서 빠져 같은 도서를 두 번 고를 수 없다", async () => {
      const user = userEvent.setup();
      renderForm();
      await fillValidRelease(user);
      const second = await addSecondBook(user);

      const optionNames = within(second)
        .getAllByRole("option")
        .map((option) => option.textContent);

      expect(optionNames).not.toContain("바이엘 상 (남은 재고 9권)");
      expect(optionNames).toContain("스즈키 바이올린 1 (남은 재고 4권)");
    });

    it("줄을 삭제하면 남은 줄 번호가 다시 매겨진다", async () => {
      const user = userEvent.setup();
      renderForm();
      await fillValidRelease(user);
      const second = await addSecondBook(user);
      await user.selectOptions(within(second).getByLabelText("도서명"), "book-2");

      await user.click(screen.getByRole("button", { name: "도서 1 삭제" }));

      expect(screen.queryByRole("group", { name: "도서 2" })).not.toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "도서 1" })).getByLabelText("도서명")).toHaveValue("book-2");
    });

    it("줄을 추가하면 새 줄의 도서 선택으로, 줄을 지우면 도서 추가 버튼으로 포커스가 옮겨 간다", async () => {
      const user = userEvent.setup();
      renderForm();
      await fillValidRelease(user);
      const second = await addSecondBook(user);

      expect(within(second).getByLabelText("도서명")).toHaveFocus();

      await user.click(screen.getByRole("button", { name: "도서 2 삭제" }));

      expect(screen.getByRole("button", { name: "도서 추가" })).toHaveFocus();
    });

    it("줄 하나라도 비어 있으면 줄 번호와 함께 이유를 알리고 등록을 막는다", async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderForm();
      await fillValidRelease(user);
      await addSecondBook(user);

      const submit = screen.getByRole("button", { name: "출고 등록" });
      expect(submit).toBeDisabled();
      expect(submit).toHaveAccessibleDescription("2번째 도서: 도서를 선택해 주세요.");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("남은 재고보다 많은 수량은 어느 줄인지 알려 준다", async () => {
      const user = userEvent.setup();
      renderForm();
      await fillValidRelease(user);
      const second = await addSecondBook(user);
      await user.selectOptions(within(second).getByLabelText("도서명"), "book-2");
      await user.clear(within(second).getByLabelText("수량"));
      await user.type(within(second).getByLabelText("수량"), "5");

      expect(screen.getByText("2번째 도서: 재고가 부족합니다. 남은 재고는 4권입니다.")).toBeInTheDocument();
    });

    it("원장의 결제 상태·입금일은 묶음 전체에 한 번만 입력한다", async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderForm({ canRecordPayment: true });
      await fillValidRelease(user);
      const second = await addSecondBook(user);
      await user.selectOptions(within(second).getByLabelText("도서명"), "book-2");
      await user.selectOptions(screen.getByLabelText("결제 상태"), "paid");

      expect(screen.getAllByLabelText("결제 상태")).toHaveLength(1);
      expect(screen.getAllByLabelText("입금일")).toHaveLength(1);
      await user.click(screen.getByRole("button", { name: "출고 등록" }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ status: "paid", paidOn: "2026-10-15", items: expect.arrayContaining([expect.anything(), expect.anything()]) }),
      );
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
