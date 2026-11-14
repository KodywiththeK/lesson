import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

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
      expect(onAction).toHaveBeenCalledWith("mark-paid", { paidOn: "2026-11-14", paymentMethod: "cash" }),
    );
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
