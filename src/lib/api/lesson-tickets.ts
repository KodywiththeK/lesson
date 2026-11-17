import { compareKoreanNames, type ListView } from "@/domain/common-list";
import {
  buildLessonTicketList,
  type BuildLessonTicketListOptions,
  type LessonTicketAdjustmentInput,
  type LessonTicketListItem,
  type LessonTicketListRow,
} from "@/domain/lesson-ticket";

import type { LessonTicketRefundPolicy, LessonTicketRefundQuote } from "@/domain/lesson-ticket-refund";

import type { LessonTicketPaymentChangeAction, LessonTicketPaymentStatus } from "@/domain/lesson-ticket-payment";
import type { TuitionPaymentMethod } from "@/domain/tuition-income";
import type { CardFeeChoice } from "@/domain/card-fee";
import { toCardFeeRpcParams } from "./card-fee-rates";
import { fetchAllRows, type PagedSelectQuery } from "./paged-query";
import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type LessonTicketGrantSupabaseRow = {
  id: string;
  academy_id: string;
  student_id: string;
  instrument_id: string;
  instrument_name: string;
  total_granted_count: number;
  remaining_count: number;
  service_total_count?: number;
  service_remaining_count?: number;
  valid_from: string;
  valid_until: string;
  registered_at: string;
  payment_status?: LessonTicketPaymentStatus;
  due_on?: string | null;
  payment_method?: TuitionPaymentMethod | null;
  legacy_merged?: boolean;
  students: {
    name: string | null;
  } | null;
};

export type LessonTicketCancellationHistoryRow = {
  id: string; mode: "refund" | "mistake"; student_name: string | null;
  instrument_name: string | null; total_count: number | null; remaining_count: number | null;
  registered_at: string | null; valid_until: string | null; refund_amount: number | null; occurred_at: string;
};

type LessonTicketListFromBuilder = {
  select(select: string): PagedSelectQuery<LessonTicketGrantSupabaseRow>;
};

export type LessonTicketListSupabaseClient = {
  from(table: "lesson_ticket_grants"): LessonTicketListFromBuilder;
};

export type FetchLessonTicketListOptions = BuildLessonTicketListOptions;

export type LessonTicketRegistrationInstrumentOption = {
  instrumentId: string;
  instrumentName: string;
};

export type LessonTicketRegistrationStudentOption = {
  studentId: string;
  studentName: string;
  instruments: LessonTicketRegistrationInstrumentOption[];
};

export type LessonTicketRegistrationOptionsSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  student_instruments:
    | Array<{
        instrument_id: string | null;
        instrument_name: string | null;
        lesson_type: string | null;
        active: boolean | null;
      }>
    | null;
};

type LessonTicketRegistrationOptionsFromBuilder = {
  select(select: string): PagedSelectQuery<LessonTicketRegistrationOptionsSupabaseRow>;
};

export type LessonTicketRegistrationOptionsSupabaseClient = {
  from(table: "students"): LessonTicketRegistrationOptionsFromBuilder;
};

export type AssignedLessonTicketBalance = {
  studentId: string;
  instrumentId: string;
  remainingCount: number;
  validUntil: string;
};

type AssignedLessonTicketBalanceRow = {
  student_id: string;
  instrument_id: string;
  remaining_count: number;
  valid_until: string;
};

export type AssignedLessonTicketBalanceSupabaseClient = {
  rpc(
    functionName: "get_assigned_lesson_ticket_balances",
    payload: { p_academy_id: string },
  ): PromiseLike<SupabaseQueryResult<AssignedLessonTicketBalanceRow[]>>;
};

export type RegisterLessonTicketInput = {
  academyId: string;
  studentId: string;
  instrumentId: string;
  instrumentName: string;
  grantedCount: number;
  /** 사용 기한(일수). 만료일은 서버가 등록일 + 기한으로 계산한다. */
  validDays: number;
  registeredAt: string;
  /** 일반 등록은 양수, 서비스 지급은 0원이다. */
  paidAmount?: number;
  isService?: boolean;
  /** 납입일. 생략하면 등록일, null이면 미정으로 등록한다(회차권 목록에서 나중에 입력). */
  dueOn?: string | null;
};

export type RevokeServiceLessonTicketInput = {
  academyId: string;
  ticketId: string;
  count: number;
  reason: string;
};

export type RevokeServiceLessonTicketClient = {
  rpc(functionName: "revoke_service_lesson_ticket", payload: {
    p_academy_id: string;
    p_ticket_id: string;
    p_count: number;
    p_reason: string;
  }): PromiseLike<SupabaseQueryResult<{ revoked_count: number }>>;
};

export async function revokeServiceLessonTicket(
  client: RevokeServiceLessonTicketClient,
  input: RevokeServiceLessonTicketInput,
): Promise<number> {
  const { data, error } = await client.rpc("revoke_service_lesson_ticket", {
    p_academy_id: input.academyId,
    p_ticket_id: input.ticketId,
    p_count: input.count,
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(`서비스 회차를 회수하지 못했습니다: ${error.message}`);
  if (!data) throw new Error("서비스 회차 회수 결과가 없습니다.");
  return data.revoked_count;
}

export type RegisterLessonTicketResult = {
  ticketId: string;
  /** 기존 서버 응답과의 호환 필드. 신규 구매는 항상 false다. */
  merged: boolean;
  totalGrantedCount: number;
  remainingCount: number;
  validFrom: string;
  validUntil: string;
};

export type AdjustLessonTicketInput = LessonTicketAdjustmentInput & {
  academyId: string;
  ticketId: string;
};

export type AdjustLessonTicketResult = {
  ticketId: string;
  totalGrantedCount: number;
  remainingCount: number;
  validUntil: string;
};

type RegisterLessonTicketRpcRow = {
  ticket_id: string;
  merged: boolean;
  total_granted_count: number;
  remaining_count: number;
  valid_from: string;
  valid_until: string;
};

type AdjustLessonTicketRpcRow = {
  ticket_id: string;
  total_granted_count: number;
  remaining_count: number;
  valid_until: string;
};

export type RegisterLessonTicketSupabaseClient = {
  rpc(
    functionName: "register_lesson_ticket",
    payload: {
      p_academy_id: string;
      p_student_id: string;
      p_instrument_id: string;
      p_instrument_name: string;
      p_granted_count: number;
      p_valid_days: number;
      p_registered_at: string;
      p_paid_amount: number;
      p_is_service: boolean;
      p_due_on: string | null;
    },
  ): PromiseLike<SupabaseQueryResult<RegisterLessonTicketRpcRow>>;
};

export type AdjustLessonTicketSupabaseClient = {
  rpc(
    functionName: "adjust_lesson_ticket",
    payload: {
      p_academy_id: string;
      p_ticket_id: string;
      p_total_granted_count: number;
      p_remaining_count: number;
      p_valid_until: string;
      p_reason: string;
    },
  ): PromiseLike<SupabaseQueryResult<AdjustLessonTicketRpcRow>>;
};

/** 삭제 전에 보여 주는 환불 미리보기. 결제 금액은 데스크가 읽을 수 없어 서버가 계산한 값만 받는다. */
export type LessonTicketRefundPreview = LessonTicketRefundQuote & {
  /** 사용 이력이 없어 "잘못 등록해서 삭제"를 고를 수 있는지. */
  canDeleteAsMistake: boolean;
};

/** `refund`: 환불 처리(규정 검사 후 수입 감액). `mistake`: 잘못 등록(수입 기록까지 삭제, 사용 이력이 없을 때만). */
export type DeleteLessonTicketMode = "refund" | "mistake";

export type DeleteLessonTicketInput = {
  academyId: string;
  ticketId: string;
  mode: DeleteLessonTicketMode;
};

export type DeleteLessonTicketResult = {
  mode: DeleteLessonTicketMode;
  /** 환불 처리에서 규정에 맞아 수입이 감액되었는지. */
  refunded: boolean;
  refundAmount: number;
  /** 수입 원장이 실제로 바뀌었는지. 입금 전 환불은 금액이 있어도 원장이 그대로다. */
  ledgerChanged: boolean;
};

type LessonTicketRefundPreviewRpcRow = {
  policy: LessonTicketRefundPolicy;
  total_granted_count: number;
  used_count: number;
  eligible: boolean;
  refund_amount: number;
  can_delete_as_mistake: boolean;
};

type DeleteLessonTicketRpcRow = {
  mode: DeleteLessonTicketMode;
  refunded: boolean;
  refund_amount: number;
  ledger_changed?: boolean;
};

export type LessonTicketRefundPreviewSupabaseClient = {
  rpc(
    functionName: "get_lesson_ticket_refund_preview",
    payload: { p_academy_id: string; p_ticket_id: string },
  ): PromiseLike<SupabaseQueryResult<LessonTicketRefundPreviewRpcRow>>;
};

export type DeleteLessonTicketSupabaseClient = {
  rpc(
    functionName: "delete_lesson_ticket",
    payload: { p_academy_id: string; p_ticket_id: string; p_mode: DeleteLessonTicketMode },
  ): PromiseLike<SupabaseQueryResult<DeleteLessonTicketRpcRow>>;
};

const LESSON_TICKET_LIST_SELECT =
  "id, academy_id, student_id, instrument_id, instrument_name, total_granted_count, remaining_count, service_total_count, service_remaining_count, valid_from, valid_until, registered_at, payment_status, due_on, payment_method, legacy_merged, students!lesson_ticket_grants_academy_student_fk(name)";

/** 재무 집계처럼 페이지로 자르면 안 되는 용도. 학원의 회차권 전체를 준다. */
export async function fetchAllLessonTickets(
  supabase: LessonTicketListSupabaseClient,
  academyId: string,
): Promise<LessonTicketListItem[]> {
  const rows = await fetchAllRows("회차권 목록을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("lesson_ticket_grants")
      .select(LESSON_TICKET_LIST_SELECT)
      .eq("academy_id", academyId)
      .order("id")
      .range(from, to),
  );

  return rows.map(toLessonTicketListItem);
}

export async function fetchLessonTicketList(
  supabase: LessonTicketListSupabaseClient,
  options: FetchLessonTicketListOptions,
): Promise<ListView<LessonTicketListRow>> {
  return buildLessonTicketList(
    await fetchAllLessonTickets(supabase, options.academyId),
    options,
  );
}

export async function fetchLessonTicketRegistrationOptions(
  supabase: LessonTicketRegistrationOptionsSupabaseClient,
  academyId: string,
): Promise<LessonTicketRegistrationStudentOption[]> {
  const rows = await fetchAllRows("회차권 등록 선택지를 불러오지 못했습니다", (from, to) =>
    supabase
      .from("students")
      .select(
        "id, academy_id, name, student_instruments!student_instruments_academy_student_fk(instrument_id, instrument_name, lesson_type, active)",
      )
      .eq("academy_id", academyId)
      .order("id")
      .range(from, to),
  );

  return rows
    .map(toLessonTicketRegistrationStudentOption)
    .filter((student) => student.instruments.length > 0)
    .sort(
      (left, right) =>
        compareKoreanNames(left.studentName, right.studentName) ||
        compareKoreanNames(left.studentId, right.studentId),
    );
}

export async function fetchAssignedLessonTicketBalances(
  supabase: AssignedLessonTicketBalanceSupabaseClient,
  academyId: string,
): Promise<AssignedLessonTicketBalance[]> {
  const { data, error } = await supabase.rpc("get_assigned_lesson_ticket_balances", {
    p_academy_id: academyId,
  });
  if (error) {
    throw new Error(`담당 회차권을 불러오지 못했습니다: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    studentId: row.student_id,
    instrumentId: row.instrument_id,
    remainingCount: row.remaining_count,
    validUntil: row.valid_until,
  }));
}

export function createAssignedLessonTicketBalancesQueryOptions(
  supabase: AssignedLessonTicketBalanceSupabaseClient,
  academyId: string,
) {
  return {
    queryKey: queryKeys.lessonTickets.assignedBalances(academyId),
    queryFn: () => fetchAssignedLessonTicketBalances(supabase, academyId),
  };
}

export function createLessonTicketRegistrationOptionsQueryOptions(
  supabase: LessonTicketRegistrationOptionsSupabaseClient,
  academyId: string,
) {
  return {
    queryKey: queryKeys.lessonTickets.registrationOptions(academyId),
    queryFn: () => fetchLessonTicketRegistrationOptions(supabase, academyId),
  };
}

/**
 * 신규 구매마다 별도 회차권을 서버 RPC 한 번으로 만든다. 유료 회차권은 '등록' 상태로 시작하고
 * 수입은 입금 처리(`markLessonTicketPaid`) 때 기록한다. 서비스 지급은 바로 입금완료다.
 */
export async function registerLessonTicket(
  supabase: RegisterLessonTicketSupabaseClient,
  input: RegisterLessonTicketInput,
): Promise<RegisterLessonTicketResult> {
  if (input.isService ? (input.paidAmount ?? 0) !== 0 : !input.paidAmount || input.paidAmount <= 0) {
    throw new Error("결제 금액을 입력하거나 서비스로 지급하기를 선택해 주세요.");
  }
  const { data, error } = await supabase.rpc("register_lesson_ticket", {
    p_academy_id: input.academyId,
    p_student_id: input.studentId,
    p_instrument_id: input.instrumentId,
    p_instrument_name: input.instrumentName,
    p_granted_count: input.grantedCount,
    p_valid_days: input.validDays,
    p_registered_at: input.registeredAt,
    p_paid_amount: input.paidAmount ?? 0,
    p_is_service: Boolean(input.isService),
    // 넘기지 않으면 등록일, null이면 납입일 미정으로 등록한다(목록에서 나중에 입력).
    p_due_on: input.dueOn === undefined ? input.registeredAt : input.dueOn,
  });

  if (error) {
    throw new Error(`회차권을 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("회차권을 등록했지만 반환된 데이터가 없습니다.");
  }

  return {
    ticketId: data.ticket_id,
    merged: data.merged,
    totalGrantedCount: data.total_granted_count,
    remainingCount: data.remaining_count,
    validFrom: data.valid_from,
    validUntil: data.valid_until,
  };
}

/** 잘못 입력된 부여 회수·잔여 회수·만료일을 사유와 함께 고친다. */
export async function adjustLessonTicket(
  supabase: AdjustLessonTicketSupabaseClient,
  input: AdjustLessonTicketInput,
): Promise<AdjustLessonTicketResult> {
  const { data, error } = await supabase.rpc("adjust_lesson_ticket", {
    p_academy_id: input.academyId,
    p_ticket_id: input.ticketId,
    p_total_granted_count: input.totalGrantedCount,
    p_remaining_count: input.remainingCount,
    p_valid_until: input.validUntil,
    p_reason: input.reason,
  });

  if (error) {
    throw new Error(`회차권을 수정하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("회차권을 수정했지만 반환된 데이터가 없습니다.");
  }

  return {
    ticketId: data.ticket_id,
    totalGrantedCount: data.total_granted_count,
    remainingCount: data.remaining_count,
    validUntil: data.valid_until,
  };
}

export async function getLessonTicketRefundPreview(
  supabase: LessonTicketRefundPreviewSupabaseClient,
  input: { academyId: string; ticketId: string },
): Promise<LessonTicketRefundPreview> {
  const { data, error } = await supabase.rpc("get_lesson_ticket_refund_preview", {
    p_academy_id: input.academyId,
    p_ticket_id: input.ticketId,
  });

  if (error) {
    throw new Error(`환불 정보를 불러오지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("환불 정보를 불러왔지만 반환된 데이터가 없습니다.");
  }

  return {
    policy: data.policy,
    totalGrantedCount: data.total_granted_count,
    usedCount: data.used_count,
    eligible: data.eligible,
    refundAmount: data.refund_amount,
    canDeleteAsMistake: data.can_delete_as_mistake,
  };
}

/** 회차권을 삭제한다. 환불 처리는 학원 환불 규정을 서버가 검사해 수입을 같은 트랜잭션에서 정리한다. */
export async function deleteLessonTicket(
  supabase: DeleteLessonTicketSupabaseClient,
  input: DeleteLessonTicketInput,
): Promise<DeleteLessonTicketResult> {
  const { data, error } = await supabase.rpc("delete_lesson_ticket", {
    p_academy_id: input.academyId,
    p_ticket_id: input.ticketId,
    p_mode: input.mode,
  });

  if (error) {
    throw new Error(`회차권을 삭제하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("회차권을 삭제했지만 반환된 데이터가 없습니다.");
  }

  return {
    mode: data.mode,
    refunded: data.refunded,
    refundAmount: data.refund_amount,
    ledgerChanged: data.ledger_changed ?? false,
  };
}

export function createLessonTicketListQueryKey(
  options: FetchLessonTicketListOptions,
) {
  return queryKeys.lessonTickets.list(options.academyId, {
    today: options.today,
    q: options.search,
    status: options.filters?.status,
    group: options.filters?.group,
    activeStatus: options.filters?.activeStatus,
    page: options.page?.toString(),
    pageSize: options.pageSize?.toString(),
  });
}

export function createLessonTicketListQueryOptions(
  supabase: LessonTicketListSupabaseClient,
  options: FetchLessonTicketListOptions,
) {
  return {
    queryKey: createLessonTicketListQueryKey(options),
    queryFn: () => fetchLessonTicketList(supabase, options),
  };
}

function toLessonTicketListItem(
  row: LessonTicketGrantSupabaseRow,
): LessonTicketListItem {
  return {
    academyId: row.academy_id,
    ticketId: row.id,
    studentId: row.student_id,
    studentName: row.students?.name?.trim() || "이름 없음",
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    totalGrantedCount: row.total_granted_count,
    remainingCount: row.remaining_count,
    serviceTotalCount: row.service_total_count ?? 0,
    serviceRemainingCount: row.service_remaining_count ?? 0,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    registeredAt: row.registered_at,
    paymentStatus: row.payment_status ?? "paid",
    // null은 미정, 칸이 없으면(상태 도입 전 자료) 화면에서 등록일로 본다(getLessonTicketDueOn).
    dueOn: row.due_on,
    ...(row.payment_method ? { paymentMethod: row.payment_method } : {}),
    ...(row.legacy_merged ? { legacyMerged: true } : {}),
  };
}

function toLessonTicketRegistrationStudentOption(
  row: LessonTicketRegistrationOptionsSupabaseRow,
): LessonTicketRegistrationStudentOption {
  return {
    studentId: row.id,
    studentName: row.name,
    instruments: (row.student_instruments ?? []).flatMap((instrument) => {
      if (
        instrument.active !== true ||
        instrument.lesson_type !== "private" ||
        !instrument.instrument_id ||
        !instrument.instrument_name?.trim()
      ) {
        return [];
      }

      return [
        {
          instrumentId: instrument.instrument_id,
          instrumentName: instrument.instrument_name,
        },
      ];
    }),
  };
}

type LessonTicketPaymentRpcArgs = {
  start_lesson_ticket_payment_wait: { p_academy_id: string; p_ticket_id: string };
  mark_lesson_ticket_paid: {
    p_academy_id: string; p_ticket_id: string; p_paid_on: string; p_payment_method: TuitionPaymentMethod;
    p_card_fee_rate_id: string | null; p_card_fee_amount: number | null;
  };
  cancel_lesson_ticket_payment: { p_academy_id: string; p_ticket_id: string };
  set_lesson_ticket_due_on: { p_academy_id: string; p_ticket_id: string; p_due_on: string };
};

export type LessonTicketPaymentSupabaseClient = {
  rpc<TName extends keyof LessonTicketPaymentRpcArgs>(
    functionName: TName,
    payload: LessonTicketPaymentRpcArgs[TName],
  ): PromiseLike<SupabaseQueryResult<unknown>>;
};

async function callLessonTicketPaymentRpc<TName extends keyof LessonTicketPaymentRpcArgs>(
  supabase: LessonTicketPaymentSupabaseClient,
  functionName: TName,
  payload: LessonTicketPaymentRpcArgs[TName],
  failure: string,
) {
  const { error } = await supabase.rpc(functionName, payload);

  if (error) {
    throw new Error(`${failure}: ${error.message}`);
  }
}

/** 등록 → 입금대기. 이때부터 예약·출석에 쓸 수 있다. */
export function startLessonTicketPaymentWait(
  supabase: LessonTicketPaymentSupabaseClient,
  input: { academyId: string; ticketId: string },
) {
  return callLessonTicketPaymentRpc(
    supabase,
    "start_lesson_ticket_payment_wait",
    { p_academy_id: input.academyId, p_ticket_id: input.ticketId },
    "입금대기로 바꾸지 못했습니다",
  );
}

/**
 * 입금대기 → 입금완료. 입금일·결제 방식과 함께 수입 내역이 같은 트랜잭션으로 기록된다.
 * 카드 입금이면 고른 카드사의 수수료가 출금으로 함께 기록된다(금액을 비우면 서버가 수수료율로 계산).
 */
export function markLessonTicketPaid(
  supabase: LessonTicketPaymentSupabaseClient,
  input: { academyId: string; ticketId: string; paidOn: string; paymentMethod: TuitionPaymentMethod; cardFee?: CardFeeChoice },
) {
  return callLessonTicketPaymentRpc(
    supabase,
    "mark_lesson_ticket_paid",
    {
      p_academy_id: input.academyId,
      p_ticket_id: input.ticketId,
      p_paid_on: input.paidOn,
      p_payment_method: input.paymentMethod,
      ...toCardFeeRpcParams(input.cardFee),
    },
    "입금 처리하지 못했습니다",
  );
}

/** 입금완료 → 입금대기. 연결된 수입 내역을 지운다. */
export function cancelLessonTicketPayment(
  supabase: LessonTicketPaymentSupabaseClient,
  input: { academyId: string; ticketId: string },
) {
  return callLessonTicketPaymentRpc(
    supabase,
    "cancel_lesson_ticket_payment",
    { p_academy_id: input.academyId, p_ticket_id: input.ticketId },
    "입금을 취소하지 못했습니다",
  );
}

/** 입금 전(등록·입금대기) 회차권의 납입일을 입력하거나 바꾼다. */
export function setLessonTicketDueOn(
  supabase: LessonTicketPaymentSupabaseClient,
  input: { academyId: string; ticketId: string; dueOn: string },
) {
  return callLessonTicketPaymentRpc(
    supabase,
    "set_lesson_ticket_due_on",
    { p_academy_id: input.academyId, p_ticket_id: input.ticketId, p_due_on: input.dueOn },
    "납입일을 저장하지 못했습니다",
  );
}

export type LessonTicketPaymentChangeInput = {
  academyId: string;
  ticketId: string;
  action: LessonTicketPaymentChangeAction;
  paidOn?: string;
  paymentMethod?: TuitionPaymentMethod;
  cardFee?: CardFeeChoice;
  dueOn?: string;
};

/** 화면의 입금 상태 버튼 하나를 알맞은 RPC로 보낸다. 회차권 목록과 수입 관리가 같이 쓴다. */
export async function applyLessonTicketPaymentChange(
  supabase: LessonTicketPaymentSupabaseClient,
  input: LessonTicketPaymentChangeInput,
) {
  const target = { academyId: input.academyId, ticketId: input.ticketId };

  if (input.action === "start-payment-wait") {
    await startLessonTicketPaymentWait(supabase, target);
  } else if (input.action === "mark-paid") {
    if (!input.paidOn || !input.paymentMethod) {
      throw new Error("입금일과 결제 방식을 입력해 주세요.");
    }
    await markLessonTicketPaid(supabase, {
      ...target, paidOn: input.paidOn, paymentMethod: input.paymentMethod, cardFee: input.cardFee,
    });
  } else if (input.action === "set-due-on") {
    if (!input.dueOn) throw new Error("납입일을 입력해 주세요.");
    await setLessonTicketDueOn(supabase, { ...target, dueOn: input.dueOn });
  } else {
    await cancelLessonTicketPayment(supabase, target);
  }
}
