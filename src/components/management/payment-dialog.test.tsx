import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FinanceConfirmDialog, PaymentDialog } from "./payment-dialog";

describe("PaymentDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("제목과 설명, 확인 버튼 문구를 호출하는 쪽이 정한다", () => {
    render(
      <PaymentDialog
        open
        title="입금 처리"
        description="입금하면 입출입내역에 수입이 기록됩니다."
        dateLabel="입금일"
        confirmLabel="입금 처리"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "입금 처리" });
    expect(within(dialog).getByText("입금하면 입출입내역에 수입이 기록됩니다.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "입금 처리" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("입금일")).toHaveValue("2026-10-15");
  });

  it("입금일이 보고 있는 월 밖이면 어느 월 내역으로 기록되는지 안내한다", async () => {
    const user = userEvent.setup();
    render(
      <PaymentDialog
        open
        title="입금 처리"
        dateLabel="입금일"
        contextMonth="2026-09"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });

    expect(within(dialog).getByText("입금일이 속한 10월 입출입내역으로 기록됩니다.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("입금일"));
    await user.type(within(dialog).getByLabelText("입금일"), "2026-09-20");

    expect(within(dialog).queryByText(/입출입내역으로 기록됩니다/)).not.toBeInTheDocument();
  });

  it("입금일이 호출하는 쪽의 검증을 통과하지 못하면 이유를 알려 주고 확인을 막는다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const validateDate = (date: string) => (date < "2026-10-10" ? "입금일은 출고일(2026-10-10) 이후여야 합니다." : null);
    render(
      <PaymentDialog
        open
        title="입금 처리"
        dateLabel="입금일"
        validateDate={validateDate}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });

    expect(within(dialog).getByRole("button", { name: "확인" })).toBeEnabled();

    await user.clear(within(dialog).getByLabelText("입금일"));
    await user.type(within(dialog).getByLabelText("입금일"), "2026-10-09");

    expect(within(dialog).getByRole("alert")).toHaveTextContent("입금일은 출고일(2026-10-10) 이후여야 합니다.");
    expect(within(dialog).getByRole("button", { name: "확인" })).toBeDisabled();

    await user.clear(within(dialog).getByLabelText("입금일"));
    await user.type(within(dialog).getByLabelText("입금일"), "2026-10-10");

    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "확인" }));
    expect(onConfirm).toHaveBeenCalledWith("2026-10-10");
  });

  it("고른 입금일에 맞는 안내를 호출하는 쪽이 정해 보여 준다", async () => {
    const user = userEvent.setup();
    const describeDate = (date: string) => ({
      message: `입금일이 속한 ${Number(date.slice(5, 7))}월에 반영됩니다.`,
      emphasized: !date.startsWith("2026-10"),
    });
    render(
      <PaymentDialog
        open
        title="입금 처리"
        dateLabel="입금일"
        describeDate={describeDate}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });

    expect(within(dialog).getByText("입금일이 속한 10월에 반영됩니다.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("입금일"));
    await user.type(within(dialog).getByLabelText("입금일"), "2026-11-02");

    expect(within(dialog).getByText("입금일이 속한 11월에 반영됩니다.")).toBeInTheDocument();
    expect(within(dialog).queryByText("입금일이 속한 10월에 반영됩니다.")).not.toBeInTheDocument();
  });

  it("처리 중에는 버튼을 막아 중복 제출을 방지한다", () => {
    render(
      <PaymentDialog
        open
        pending
        title="입금 처리"
        dateLabel="입금일"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });

    expect(within(dialog).getByRole("button", { name: "처리 중" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "취소" })).toBeDisabled();
  });

  it("입금일을 비우면 확인을 막고 이유를 알려 준다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PaymentDialog open title="입금 처리" dateLabel="입금일" onConfirm={onConfirm} onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });

    await user.clear(within(dialog).getByLabelText("입금일"));

    expect(within(dialog).getByRole("button", { name: "확인" })).toBeDisabled();
    expect(within(dialog).getByText("입금일을 입력해 주세요.")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("카드 결제이고 카드사가 있으면 카드사를 골라야 하고, 수수료를 미리 계산해 보여 주며 고칠 수 있다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PaymentDialog
        open
        requirePaymentMethod
        title="입금 처리"
        dateLabel="입금일"
        amount={150000}
        cardFeeRates={[{ id: "r1", name: "신한카드", ratePercent: 1.45 }, { id: "r2", name: "지역화폐", ratePercent: 0 }]}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });
    const confirm = within(dialog).getByRole("button", { name: "확인" });

    expect(within(dialog).queryByLabelText("카드사")).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "card");
    expect(confirm).toBeDisabled();

    await user.selectOptions(within(dialog).getByLabelText("카드사"), "r1");
    expect(within(dialog).getByLabelText("카드 수수료(원)")).toHaveValue("2175");
    expect(within(dialog).getByText("수입 150,000원과 카드 수수료 2,175원이 입출입내역에 기록됩니다.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("카드 수수료(원)"));
    await user.type(within(dialog).getByLabelText("카드 수수료(원)"), "2000");
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith("2026-10-15", "card", { rateId: "r1", amount: 2000 });
  });

  it("카드사를 바꾸면 수수료를 다시 계산하고, 카드가 아니면 카드사를 넘기지 않는다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PaymentDialog
        open
        requirePaymentMethod
        title="입금 처리"
        dateLabel="입금일"
        amount={150000}
        cardFeeRates={[{ id: "r1", name: "신한카드", ratePercent: 1.45 }, { id: "r2", name: "지역화폐", ratePercent: 0 }]}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });

    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "card");
    await user.selectOptions(within(dialog).getByLabelText("카드사"), "r1");
    await user.clear(within(dialog).getByLabelText("카드 수수료(원)"));
    await user.type(within(dialog).getByLabelText("카드 수수료(원)"), "9");
    await user.selectOptions(within(dialog).getByLabelText("카드사"), "r2");
    expect(within(dialog).getByLabelText("카드 수수료(원)")).toHaveValue("0");

    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "cash");
    expect(within(dialog).queryByLabelText("카드사")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    expect(onConfirm).toHaveBeenCalledWith("2026-10-15", "cash", undefined);
  });

  it("카드사 목록을 아직 못 읽었으면 카드 입금 확인을 막는다(카드사 없음으로 보지 않는다)", async () => {
    const user = userEvent.setup();
    render(
      <PaymentDialog
        open
        requirePaymentMethod
        title="입금 처리"
        dateLabel="입금일"
        cardFeeRatesUnavailable
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });

    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "card");
    expect(within(dialog).getByText("카드사 목록을 확인하지 못했습니다. 잠시 후 다시 열어 주세요.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "확인" })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "cash");
    expect(within(dialog).getByRole("button", { name: "확인" })).toBeEnabled();
  });

  it("결제 금액을 모르면(데스크) 수수료 칸 없이 수수료율로 자동 계산된다고 알린다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PaymentDialog
        open
        requirePaymentMethod
        title="입금 처리"
        dateLabel="입금일"
        cardFeeRates={[{ id: "r1", name: "신한카드", ratePercent: 1.45 }]}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "입금 처리" });

    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "card");
    await user.selectOptions(within(dialog).getByLabelText("카드사"), "r1");
    expect(within(dialog).queryByLabelText("카드 수수료(원)")).not.toBeInTheDocument();
    expect(within(dialog).getByText("카드 수수료(1.45%)가 입출입내역에 출금으로 함께 기록됩니다.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    expect(onConfirm).toHaveBeenCalledWith("2026-10-15", "card", { rateId: "r1" });
  });

  it("입금일을 잘못 입력하면 이전 날짜로 확인하지 않는다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PaymentDialog open title="입금 처리" dateLabel="입금일" onConfirm={onConfirm} onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByLabelText("입금일");
    await user.type(field, "x");
    await user.tab();

    expect(field).toHaveValue("2026-10-15x");
    expect(within(dialog).getByRole("button", { name: "확인" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("FinanceConfirmDialog", () => {
  it("되돌리기 어려운 동작은 무엇이 일어나는지 알리고 확인해야 실행한다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <FinanceConfirmDialog
        open
        title="입금을 취소할까요?"
        description="연결된 입출입내역 1건이 삭제됩니다."
        confirmLabel="입금 취소"
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "입금을 취소할까요?" });

    expect(within(dialog).getByText("연결된 입출입내역 1건이 삭제됩니다.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "입금 취소" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("처리 중에는 확인·취소를 막는다", () => {
    render(
      <FinanceConfirmDialog
        open
        pending
        title="입금을 취소할까요?"
        description="설명"
        confirmLabel="입금 취소"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "입금을 취소할까요?" });

    expect(within(dialog).getByRole("button", { name: "처리 중" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "취소" })).toBeDisabled();
  });
});
