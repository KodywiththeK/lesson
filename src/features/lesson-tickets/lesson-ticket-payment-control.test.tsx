import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LessonTicketPaymentControl } from "./lesson-ticket-payment-control";

function renderControl(props: Partial<ComponentProps<typeof LessonTicketPaymentControl>> = {}) {
  const onAction = vi.fn().mockResolvedValue(undefined);
  render(
    <LessonTicketPaymentControl
      ticket={{ ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "registered", dueOn: "2026-11-20" }}
      today="2026-11-14"
      canManage
      onAction={onAction}
      {...props}
    />,
  );

  return { onAction, user: userEvent.setup() };
}

describe("LessonTicketPaymentControl", () => {
  // 입금일·납입일 기본값이 오늘(서울)이라 날짜를 고정한다.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T03:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("상태와 납입일을 보여 주고 등록 상태에서는 입금대기 버튼으로 바로 바꾼다", async () => {
    const { onAction, user } = renderControl();

    expect(screen.getByText("등록")).toHaveAttribute("data-variant");
    expect(screen.getByText("납입일 2026-11-20")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "김민지 피아노 입금대기로 전환" }));

    expect(onAction).toHaveBeenCalledWith("start-payment-wait", {});
  });

  it("입금대기는 입금일·결제 방식을 받아 입금 처리한다", async () => {
    const { onAction, user } = renderControl({
      ticket: { ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "payment-pending", dueOn: "2026-11-20", amount: 200000 },
    });

    await user.click(screen.getByRole("button", { name: "김민지 피아노 입금 처리" }));
    const dialog = await screen.findByRole("dialog", { name: "회차권 입금 처리" });
    expect(dialog).toHaveTextContent("200,000원");
    await user.selectOptions(screen.getByLabelText("결제 방식"), "cash");
    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith("mark-paid", { paidOn: "2026-11-14", paymentMethod: "cash", cardFee: undefined }),
    );
  });

  it("카드 입금은 카드사를 고르고 계산된 수수료와 함께 입금 처리한다", async () => {
    const { onAction, user } = renderControl({
      ticket: { ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "payment-pending", dueOn: "2026-11-20", amount: 200000 },
      cardFeeRates: [{ id: "r1", name: "신한카드", ratePercent: 1.45 }],
    });

    await user.click(screen.getByRole("button", { name: "김민지 피아노 입금 처리" }));
    await user.selectOptions(await screen.findByLabelText("결제 방식"), "card");
    await user.selectOptions(screen.getByLabelText("카드사"), "r1");
    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith("mark-paid", {
        paidOn: "2026-11-14", paymentMethod: "card", cardFee: { rateId: "r1", amount: 2900 },
      }),
    );
  });

  it("납입일 미정이면 '납입일 미정'으로 보이고 입금 전에는 납입일을 입력한다", async () => {
    const { onAction, user } = renderControl({
      ticket: { ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "registered", dueOn: null },
    });

    expect(screen.getByText("납입일 미정")).toBeInTheDocument();
    expect(screen.queryByText("납입일 경과")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "김민지 피아노 납입일 입력" }));
    const dueOn = await screen.findByLabelText("납입일");
    await user.clear(dueOn);
    await user.type(dueOn, "2026-11-25");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onAction).toHaveBeenCalledWith("set-due-on", { dueOn: "2026-11-25" }));
  });

  it("납입일이 있으면 수정 버튼을 두고, 입금완료 뒤에는 납입일을 바꾸지 않는다", () => {
    const { unmount } = render(
      <LessonTicketPaymentControl
        ticket={{ ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "payment-pending", dueOn: "2026-11-20" }}
        today="2026-11-14"
        canManage
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "김민지 피아노 납입일 수정" })).toBeInTheDocument();
    unmount();

    renderControl({
      ticket: { ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "paid", dueOn: "2026-11-20" },
    });
    expect(screen.queryByRole("button", { name: /납입일/ })).not.toBeInTheDocument();
  });

  it("입금완료는 확인을 받은 뒤 입금 취소하고, 결제 방식을 함께 보여 준다", async () => {
    const { onAction, user } = renderControl({
      ticket: { ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "paid", dueOn: "2026-11-20", paymentMethod: "transfer" },
    });

    expect(screen.getByText("입금완료")).toBeInTheDocument();
    expect(screen.getByText("계좌이체")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "김민지 피아노 입금 취소" }));
    await user.click(await screen.findByRole("button", { name: "입금 취소" }));

    await waitFor(() => expect(onAction).toHaveBeenCalledWith("cancel-payment", {}));
  });

  it("입금 전이고 납입일이 지났으면 납입일 경과를 알린다", () => {
    renderControl({
      ticket: { ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "payment-pending", dueOn: "2026-11-10" },
    });

    expect(screen.getByText("납입일 경과")).toBeInTheDocument();
  });

  it("관리 권한이 없거나 서비스 지급이면 버튼을 보여 주지 않는다", () => {
    const { unmount } = render(
      <LessonTicketPaymentControl
        ticket={{ ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "registered", dueOn: "2026-11-20" }}
        today="2026-11-14"
        canManage={false}
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();

    render(
      <LessonTicketPaymentControl
        ticket={{ ticketId: "t1", studentName: "김민지", instrumentName: "피아노", paymentStatus: "paid", dueOn: "2026-11-20", isService: true }}
        today="2026-11-14"
        canManage
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
