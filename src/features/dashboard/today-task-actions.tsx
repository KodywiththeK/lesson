"use client";

import { useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PaymentDialog } from "@/components/management/payment-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { findMakeupWindowMonths, recommendMakeupDates } from "@/domain/academy-makeup-recommendation";
import { buildAbsenceResolutionRequest } from "@/domain/academy-lesson-absence";
import { toAbsenceResolutionRow, type DailyTaskAction } from "@/domain/daily-tasks";
import { formatWon } from "@/domain/money-input";
import { AcademyAbsenceResolutionDialog } from "@/features/lessons/academy-absence-resolution-dialog";
import type { AbsenceResolutionDraft } from "@/features/lessons/workspace-types";
import { BookOrderActionDialog } from "@/features/books/book-order-action-dialog";
import { LessonTicketPaymentControl } from "@/features/lesson-tickets/lesson-ticket-payment-control";
import { LessonTicketRegistrationForm } from "@/features/lesson-tickets/lesson-ticket-registration-form";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";

import type { TodayTaskProcessing } from "./today-task-processing";

type DialogAction = Exclude<DailyTaskAction, { type: "ticket-payment" }>;

type ActionContext = {
  academyId: string;
  today: string;
  processing: TodayTaskProcessing;
  /** 처리가 끝나면 부른다. 부른 쪽이 할 일 원천을 다시 읽는다. */
  onProcessed: () => Promise<void>;
};

type ActionDialogProps<Type extends DialogAction["type"]> = Omit<ActionContext, "onProcessed"> & {
  action: Extract<DialogAction, { type: Type }>;
  onClose: () => void;
  onDone: () => void;
};

/** 처리 버튼 이름. */
const ACTION_LABELS: Record<DialogAction["type"], string> = {
  "tuition-payment": "입금 확인",
  "book-receive": "입고 확인",
  "ticket-renewal": "재등록",
  "absence-resolution": "보강·패스 정하기",
};

/**
 * 할 일 카드의 처리 부분. 각 화면의 입력 창을 그대로 쓴다.
 * 회차권 입금은 상태별 버튼이 여럿이라 회차권 화면의 입금 버튼 묶음을 카드 안에 두고, 나머지는 버튼으로 창을 연다.
 */
export function TodayTaskActionControl({ action, ...context }: ActionContext & { action: DailyTaskAction }) {
  const [open, setOpen] = useState(false);

  if (action.type === "ticket-payment") {
    return <TicketPaymentAction action={action} {...context} />;
  }

  const dialogProps = {
    academyId: context.academyId,
    today: context.today,
    processing: context.processing,
    onClose: () => setOpen(false),
    onDone: () => {
      setOpen(false);
      void context.onProcessed();
    },
  };

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {ACTION_LABELS[action.type]}
      </Button>
      {open ? <ActionDialog action={action} {...dialogProps} /> : null}
    </>
  );
}

function ActionDialog({ action, ...props }: Omit<ActionDialogProps<DialogAction["type"]>, "action"> & { action: DialogAction }) {
  switch (action.type) {
    case "tuition-payment":
      return <TuitionPaymentAction action={action} {...props} />;
    case "book-receive":
      return <BookReceiveAction action={action} {...props} />;
    case "ticket-renewal":
      return <TicketRenewalAction action={action} {...props} />;
    case "absence-resolution":
      return <AbsenceResolutionAction action={action} {...props} />;
  }
}

function useCardFeeRates(academyId: string, processing: TodayTaskProcessing) {
  return useQuery({ queryKey: queryKeys.settings.cardFeeRates(academyId), queryFn: processing.loadCardFeeRates });
}

function TicketPaymentAction({
  action,
  academyId,
  today,
  processing,
  onProcessed,
}: ActionContext & { action: Extract<DailyTaskAction, { type: "ticket-payment" }> }) {
  const cardFeeRates = useCardFeeRates(academyId, processing);
  const [pending, setPending] = useState(false);

  return (
    <div className="basis-full">
      <LessonTicketPaymentControl
        ticket={action.ticket}
        today={today}
        canManage
        cardFeeRates={cardFeeRates.data}
        cardFeeRatesUnavailable={!cardFeeRates.isSuccess}
        pending={pending}
        onAction={async (change, input) => {
          setPending(true);
          try {
            await processing.changeTicketPayment({ ticketId: action.ticket.ticketId, action: change, ...input });
            toast.success("회차권 입금 상태를 바꿨습니다.");
            await onProcessed();
          } catch (error) {
            toast.error(toUserMessage(error));
            // 입금 창을 열어 둬서 다시 시도할 수 있게 한다.
            throw error;
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}

function TuitionPaymentAction({ action, academyId, processing, onClose, onDone }: ActionDialogProps<"tuition-payment">) {
  const cardFeeRates = useCardFeeRates(academyId, processing);
  const pay = useMutation({
    mutationFn: (input: Parameters<TodayTaskProcessing["markTuitionPaid"]>[0]) => processing.markTuitionPaid(input),
    onSuccess: () => {
      toast.success("입금 처리했습니다.");
      onDone();
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  return (
    <PaymentDialog
      requirePaymentMethod
      open
      title="수강료 입금 확인"
      description={`${action.studentName} · ${action.instrumentName}${
        action.amount === undefined ? "" : ` · ${formatWon(action.amount)}`
      }. 확인하면 입출입내역에 수입이 기록됩니다. 카드는 카드 수수료도 출금으로 함께 기록됩니다.`}
      dateLabel="입금일"
      contextMonth={action.month}
      amount={action.amount}
      cardFeeRates={cardFeeRates.data}
      cardFeeRatesUnavailable={!cardFeeRates.isSuccess}
      pending={pay.isPending}
      onConfirm={(paidAt, paymentMethod, cardFee) => {
        if (paymentMethod) {
          pay.mutate({ snapshotId: action.snapshotId, paidAt, paymentMethod, cardFee });
        }
      }}
      onOpenChange={(open) => !open && onClose()}
    />
  );
}

function BookReceiveAction({ action, academyId, processing, onClose, onDone }: ActionDialogProps<"book-receive">) {
  const orderQuery = useQuery({
    queryKey: [...queryKeys.books.all(academyId), "order", action.orderId],
    queryFn: () => processing.loadBookOrder(action.orderId),
  });
  const receive = useMutation({
    mutationFn: (input: Parameters<TodayTaskProcessing["receiveBookOrder"]>[0]) => processing.receiveBookOrder(input),
    onSuccess: () => {
      toast.success("입고 처리했습니다.");
      onDone();
    },
  });

  if (orderQuery.data) {
    return (
      <BookOrderActionDialog
        order={orderQuery.data}
        action="receive"
        pending={receive.isPending}
        errorMessage={receive.error ? toUserMessage(receive.error) : null}
        onClose={onClose}
        onConfirm={(receivedOn, salePrices = {}) =>
          receive.mutate({ orderId: action.orderId, receivedOn, salePrices })
        }
      />
    );
  }

  return (
    <StatusDialog
      title="교재 입고 확인"
      onClose={onClose}
      message={
        orderQuery.isPending
          ? "발주 내용을 불러오는 중입니다."
          : orderQuery.error
            ? toUserMessage(orderQuery.error)
            : "이미 처리했거나 찾을 수 없는 발주입니다."
      }
      isError={!orderQuery.isPending}
    />
  );
}

function TicketRenewalAction({ action, academyId, today, processing, onClose, onDone }: ActionDialogProps<"ticket-renewal">) {
  const optionsQuery = useQuery({
    queryKey: queryKeys.lessonTickets.registrationOptions(academyId),
    queryFn: processing.loadTicketRegistrationOptions,
  });
  const register = useMutation({
    mutationFn: (input: Parameters<TodayTaskProcessing["registerLessonTicket"]>[0]) => processing.registerLessonTicket(input),
    onSuccess: () => {
      toast.success("회차권을 등록했습니다.");
      onDone();
    },
    onError: (error) => toast.error("회차권 등록에 실패했습니다.", { description: toUserMessage(error) }),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !register.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>회차권 재등록</DialogTitle>
          <DialogDescription>새 구매 건으로 회차권을 등록합니다. 학생과 악기는 미리 골라 두었습니다.</DialogDescription>
        </DialogHeader>
        <LessonTicketRegistrationForm
          academyId={academyId}
          today={today}
          options={optionsQuery.data ?? []}
          isLoading={optionsQuery.isPending}
          error={optionsQuery.error}
          isSaving={register.isPending}
          canRecordPayment
          initialStudentId={action.studentId}
          initialInstrumentId={action.instrumentId}
          onSubmit={(input) => register.mutate(input)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AbsenceResolutionAction({ action, academyId, processing, onClose, onDone }: ActionDialogProps<"absence-resolution">) {
  const { absence } = action;
  const [draft, setDraft] = useState<AbsenceResolutionDraft>(() => ({
    row: toAbsenceResolutionRow(absence, academyId),
    resolution: "",
    targetDate: "",
    startTime: "",
    reason: absence.absenceReason ?? "",
  }));
  // 추천 기간이 걸치는 달의 등원 인원을 읽는다(레슨표와 같은 기준).
  const months = findMakeupWindowMonths(absence.lessonDate);
  const counts = useQueries({
    queries: months.map((month) => ({
      queryKey: [...queryKeys.lessonWorkspace.month(academyId, month), "attendee-counts"],
      queryFn: () => processing.loadAttendeeCounts(month),
    })),
  });
  const countsReady = counts.every((query) => query.isSuccess);
  const recommendations = countsReady
    ? recommendMakeupDates({
        absentDate: absence.lessonDate,
        regularWeekdays: absence.regularWeekdays,
        attendeeCountByDate: Object.assign({}, ...counts.map((query) => query.data)),
      })
    : [];
  const resolve = useMutation({
    mutationFn: (input: Parameters<TodayTaskProcessing["resolveAbsence"]>[0]) => processing.resolveAbsence(input),
    onSuccess: (_result, input) => {
      toast.success(input.resolution === "makeup" ? "보강 일정을 저장했습니다." : "패스로 처리했습니다.");
      onDone();
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  return (
    <AcademyAbsenceResolutionDialog
      draft={draft}
      recommendations={recommendations}
      recommendationsLoading={counts.some((query) => query.isPending)}
      recommendationError={counts.some((query) => query.isError)}
      onRetryRecommendations={() => counts.forEach((query) => query.isError && void query.refetch())}
      isSaving={resolve.isPending}
      onChange={setDraft}
      onClose={onClose}
      onConfirm={async (next) => {
        const built = buildAbsenceResolutionRequest(next, next.row);
        if (!built.ok) {
          toast.error(built.reason);
          return;
        }
        await resolve.mutateAsync(built.request).catch(() => undefined);
      }}
    />
  );
}

function StatusDialog({
  title,
  message,
  isError,
  onClose,
}: {
  title: string;
  message: string;
  isError: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <EmptyState role={isError ? "alert" : "status"}>{message}</EmptyState>
      </DialogContent>
    </Dialog>
  );
}
