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
