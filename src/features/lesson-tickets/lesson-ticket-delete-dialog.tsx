"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { LessonTicketListRow } from "@/domain/lesson-ticket";
import { formatLessonTicketRefundPolicy } from "@/domain/lesson-ticket-refund";
import type { DeleteLessonTicketMode, LessonTicketRefundPreview } from "@/lib/api/lesson-tickets";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";

type LessonTicketDeleteDialogProps = {
  ticket: LessonTicketListRow | null;
  /** 학원 환불 규정으로 계산한 환불 미리보기. 결제 금액은 서버만 알고 있다. */
  loadPreview: (ticketId: string) => Promise<LessonTicketRefundPreview>;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (ticket: LessonTicketListRow, mode: DeleteLessonTicketMode) => void;
};

/**
 * 회차권 삭제 확인. 기본은 환불 처리(학원 환불 규정을 검사해 수입을 정리)이고,
 * 사용 이력이 없는 회차권은 "잘못 등록해서 삭제"로 수입 기록까지 지울 수 있다.
 * 끝나기 전에는 닫히지 않으며 처리 중에는 중복 클릭을 막는다.
 */
export function LessonTicketDeleteDialog({
  ticket,
  loadPreview,
  isDeleting,
  onClose,
  onConfirm,
}: LessonTicketDeleteDialogProps) {
  return (
    <AlertDialog open={ticket !== null} onOpenChange={(open) => (open || isDeleting ? undefined : onClose())}>
      {ticket ? (
        <LessonTicketDeleteContent
          key={ticket.ticketId}
          ticket={ticket}
          loadPreview={loadPreview}
          isDeleting={isDeleting}
          onConfirm={onConfirm}
        />
      ) : null}
    </AlertDialog>
  );
}

function LessonTicketDeleteContent({
  ticket,
  loadPreview,
  isDeleting,
  onConfirm,
}: {
  ticket: LessonTicketListRow;
  loadPreview: (ticketId: string) => Promise<LessonTicketRefundPreview>;
  isDeleting: boolean;
  onConfirm: (ticket: LessonTicketListRow, mode: DeleteLessonTicketMode) => void;
}) {
  const [mode, setMode] = useState<DeleteLessonTicketMode>("refund");
  const previewQuery = useQuery({
    queryKey: queryKeys.lessonTickets.refundPreview(ticket.academyId, ticket.ticketId),
    queryFn: () => loadPreview(ticket.ticketId),
    // 참고용 미리보기다. 실제 금액은 삭제 때 서버가 다시 계산하므로 창이 열려 있는 동안 다시 부르지 않는다.
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });
  const preview = previewQuery.data;

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>회차권을 삭제할까요?</AlertDialogTitle>
        <AlertDialogDescription>
          {ticket.studentName} {ticket.instrumentName} 회차권을 삭제합니다. 삭제한 회차권은 되돌릴 수 없습니다.
        </AlertDialogDescription>
      </AlertDialogHeader>

      {previewQuery.isLoading ? <p className="text-sm text-muted-foreground">환불 정보를 불러오는 중입니다.</p> : null}
      {previewQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {toUserMessage(previewQuery.error)}
        </p>
      ) : null}

      {preview ? (
        <RadioGroup
          aria-label="삭제 방식"
          value={mode}
          onValueChange={(value) => setMode(value as DeleteLessonTicketMode)}
        >
          <DeleteModeOption
            value="refund"
            label="환불 처리"
            description={describeRefund(preview)}
            checked={mode === "refund"}
          />
          <DeleteModeOption
            value="mistake"
            label="잘못 등록해서 삭제"
            description={
              preview.canDeleteAsMistake
                ? "수입 내역에 기록된 결제도 함께 지워집니다. 아직 한 번도 쓰지 않은 회차권만 고를 수 있습니다."
                : "이미 사용한 회차권이라 선택할 수 없습니다."
            }
            checked={mode === "mistake"}
            disabled={!preview.canDeleteAsMistake}
          />
        </RadioGroup>
      ) : null}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={!preview || isDeleting}
          onClick={(event) => {
            // 삭제가 끝나기 전에는 닫지 않는다. 성공하면 호출한 쪽이 대상을 비운다.
            event.preventDefault();
            onConfirm(ticket, mode);
          }}
        >
          {isDeleting ? "처리 중" : "삭제"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

function DeleteModeOption({
  value,
  label,
  description,
  checked,
  disabled = false,
}: {
  value: DeleteLessonTicketMode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      data-state={checked ? "checked" : "unchecked"}
      className="flex items-start gap-3 rounded-lg border border-border p-3 has-[:disabled]:opacity-60 data-[state=checked]:border-primary data-[state=checked]:bg-accent"
    >
      <RadioGroupItem value={value} disabled={disabled} className="mt-1" />
      <span className="grid gap-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function describeRefund(preview: LessonTicketRefundPreview) {
  const standing = `현재 규정: ${formatLessonTicketRefundPolicy(preview.policy)}. 사용 ${preview.usedCount}/${preview.totalGrantedCount}회.`;

  if (!preview.eligible) {
    return `${standing} 현재 규정으로는 환불할 수 없습니다. 회차권만 삭제되고 수입 내역은 그대로 남습니다.`;
  }

  if (preview.refundAmount === 0) {
    return `${standing} 돌려줄 금액이 없습니다. 회차권만 삭제되고 수입 내역은 그대로 남습니다.`;
  }

  return `${standing} 환불 예정 금액 ${preview.refundAmount.toLocaleString("ko-KR")}원이며 수입 내역에서 같은 금액이 줄어듭니다.`;
}
