import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LessonTicketListRow } from "@/domain/lesson-ticket";
import type { LessonTicketRefundPreview } from "@/lib/api/lesson-tickets";

import { LessonTicketDeleteDialog } from "./lesson-ticket-delete-dialog";

const ticket = {
  academyId: "academy-1",
  ticketId: "ticket-1",
  studentId: "student-1",
  studentName: "한서아",
  instrumentId: "violin",
  instrumentName: "바이올린",
  totalGrantedCount: 8,
  remainingCount: 2,
  validFrom: "2026-08-01",
  validUntil: "2026-08-28",
  registeredAt: "2026-08-01",
  statuses: [],
} as unknown as LessonTicketListRow;

const eligiblePreview: LessonTicketRefundPreview = {
  policy: "proportional_always",
  totalGrantedCount: 8,
  usedCount: 6,
  eligible: true,
  refundAmount: 70_000,
  canDeleteAsMistake: false,
};

function renderDialog({
  preview = eligiblePreview,
  loadError,
  isDeleting = false,
  onClose = vi.fn(),
  onConfirm = vi.fn(),
}: {
  preview?: LessonTicketRefundPreview;
  loadError?: Error;
  isDeleting?: boolean;
  onClose?: () => void;
  onConfirm?: (ticket: LessonTicketListRow, mode: "refund" | "mistake") => void;
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <LessonTicketDeleteDialog
        ticket={ticket}
        loadPreview={async () => {
          if (loadError) throw loadError;
          return preview;
        }}
        isDeleting={isDeleting}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </QueryClientProvider>,
  );

  return { onClose, onConfirm };
}

describe("LessonTicketDeleteDialog", () => {
  it("대상이 없으면 열리지 않는다", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LessonTicketDeleteDialog
          ticket={null}
          loadPreview={vi.fn()}
          isDeleting={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("규정에 맞으면 현재 규정과 사용 횟수, 환불 예정 금액을 알린다", async () => {
    renderDialog();

    const dialog = await screen.findByRole("alertdialog", { name: "회차권을 삭제할까요?" });
    expect(within(dialog).getByText(/한서아 바이올린 회차권/)).toBeInTheDocument();
    expect(await within(dialog).findByText(/현재 규정: 언제든 남은 회수 비례 환불/)).toBeInTheDocument();
    expect(within(dialog).getByText(/사용 6\/8회/)).toBeInTheDocument();
    expect(within(dialog).getByText(/환불 예정 금액 70,000원/)).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /환불 처리/ })).toBeChecked();
  });

  it("규정에 맞지 않으면 환불되지 않고 회차권만 삭제된다고 알린다", async () => {
    renderDialog({ preview: { ...eligiblePreview, policy: "none", eligible: false, refundAmount: 0 } });

    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText(/현재 규정으로는 환불할 수 없습니다/)).toBeInTheDocument();
    expect(within(dialog).getByText(/회차권만 삭제되고 수입 내역은 그대로 남습니다/)).toBeInTheDocument();
  });

  it("환불 대상이어도 결제 금액이 없으면 돌려줄 금액이 없다고 알린다", async () => {
    renderDialog({ preview: { ...eligiblePreview, refundAmount: 0 } });

    expect(await screen.findByText(/돌려줄 금액이 없습니다/)).toBeInTheDocument();
  });

  it("사용한 회차권은 잘못 등록으로 삭제할 수 없고 이유를 알린다", async () => {
    renderDialog();

    const dialog = await screen.findByRole("alertdialog");
    await within(dialog).findByText(/현재 규정/);
    expect(within(dialog).getByRole("radio", { name: /잘못 등록해서 삭제/ })).toBeDisabled();
    expect(within(dialog).getByText(/이미 사용한 회차권이라 선택할 수 없습니다/)).toBeInTheDocument();
  });

  it("환불 처리를 기본으로 삭제를 확인한다", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    const dialog = await screen.findByRole("alertdialog");
    await within(dialog).findByText(/현재 규정/);
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(onConfirm).toHaveBeenCalledWith(ticket, "refund");
  });

  it("사용 이력이 없으면 잘못 등록해서 삭제를 고를 수 있고 수입 기록까지 지운다고 알린다", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({
      preview: { ...eligiblePreview, usedCount: 0, canDeleteAsMistake: true },
    });

    const dialog = await screen.findByRole("alertdialog");
    await user.click(await within(dialog).findByRole("radio", { name: /잘못 등록해서 삭제/ }));
    expect(within(dialog).getByText(/수입 내역에 기록된 결제도 함께 지워집니다/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(onConfirm).toHaveBeenCalledWith(ticket, "mistake");
  });

  it("환불 정보를 불러오기 전과 불러오지 못했을 때는 삭제할 수 없다", async () => {
    renderDialog({ loadError: new Error("환불 정보를 불러오지 못했습니다: 권한이 없습니다.") });

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "삭제" })).toBeDisabled();
    expect(await within(dialog).findByText(/권한이 없습니다/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "삭제" })).toBeDisabled();
  });

  it("처리 중에는 중복 삭제와 취소를 막는다", async () => {
    renderDialog({ isDeleting: true });

    const dialog = await screen.findByRole("alertdialog");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "처리 중" })).toBeDisabled());
    expect(within(dialog).getByRole("button", { name: "취소" })).toBeDisabled();
  });

  it("취소하면 닫는다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(await screen.findByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalled();
  });
});
