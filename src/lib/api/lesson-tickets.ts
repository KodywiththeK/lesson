import {
  buildLessonTicketList,
  registerLessonTicket,
  type BuildLessonTicketListOptions,
  type LessonTicket,
  type LessonTicketListItem,
  type LessonTicketListRow,
  type LessonTicketRegistration,
  type RegisterLessonTicketResult,
} from "@/domain/lesson-ticket";

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
  valid_from: string;
  valid_until: string;
  registered_at: string;
  paid_amount?: number | null;
  paid_at?: string | null;
  students: {
    name: string | null;
  } | null;
};

type LessonTicketListSelectBuilder = {
  eq(
    column: "academy_id",
    value: string,
  ): PromiseLike<SupabaseQueryResult<LessonTicketGrantSupabaseRow[]>>;
};

type LessonTicketListFromBuilder = {
  select(select: string): LessonTicketListSelectBuilder;
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

type LessonTicketRegistrationOptionsSelectBuilder = {
  eq(
    column: "academy_id",
    value: string,
  ): PromiseLike<
    SupabaseQueryResult<LessonTicketRegistrationOptionsSupabaseRow[]>
  >;
};

type LessonTicketRegistrationOptionsFromBuilder = {
  select(select: string): LessonTicketRegistrationOptionsSelectBuilder;
};

export type LessonTicketRegistrationOptionsSupabaseClient = {
  from(table: "students"): LessonTicketRegistrationOptionsFromBuilder;
};

export type RegisterLessonTicketGrantInput = LessonTicketRegistration & {
  studentName: string;
  instrumentName: string;
  paidAmount?: number;
};

export type RegisterLessonTicketGrantResult = RegisterLessonTicketResult & {
  ticket: LessonTicketListItem;
};

type LessonTicketGrantLookupBuilder = {
  eq(
    column: "academy_id" | "student_id" | "instrument_id",
    value: string,
  ): LessonTicketGrantLookupBuilder;
  order(
    column: "valid_until",
    options: { ascending: boolean },
  ): {
    limit(
      count: number,
    ): PromiseLike<SupabaseQueryResult<LessonTicketGrantSupabaseRow[]>>;
  };
};

type LessonTicketGrantPersistBuilder = {
  eq(column: "id", value: string): LessonTicketGrantPersistBuilder;
  select(select: string): {
    single(): PromiseLike<SupabaseQueryResult<LessonTicketGrantSupabaseRow>>;
  };
};

type LessonTicketGrantRegistrationFromBuilder = {
  select(select: string): LessonTicketGrantLookupBuilder;
  update(values: Record<string, unknown>): LessonTicketGrantPersistBuilder;
  insert(values: Record<string, unknown>): LessonTicketGrantPersistBuilder;
};

type LedgerEntryInsertFromBuilder = {
  insert(values: Record<string, unknown>): PromiseLike<SupabaseQueryResult<null>>;
};

export type LessonTicketGrantRegistrationSupabaseClient = {
  from(table: "lesson_ticket_grants"): LessonTicketGrantRegistrationFromBuilder;
  from(table: "ledger_entries"): LedgerEntryInsertFromBuilder;
};

const LESSON_TICKET_LIST_SELECT =
  "id, academy_id, student_id, instrument_id, instrument_name, total_granted_count, remaining_count, valid_from, valid_until, registered_at, paid_amount, paid_at, students(name)";

export async function fetchLessonTicketList(
  supabase: LessonTicketListSupabaseClient,
  options: FetchLessonTicketListOptions,
): Promise<LessonTicketListRow[]> {
  const { data, error } = await supabase
    .from("lesson_ticket_grants")
    .select(LESSON_TICKET_LIST_SELECT)
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`회차권 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildLessonTicketList((data ?? []).map(toLessonTicketListItem), options);
}

export async function fetchLessonTicketRegistrationOptions(
  supabase: LessonTicketRegistrationOptionsSupabaseClient,
  academyId: string,
): Promise<LessonTicketRegistrationStudentOption[]> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, academy_id, name, student_instruments(instrument_id, instrument_name, lesson_type, active)",
    )
    .eq("academy_id", academyId);

  if (error) {
    throw new Error(`회차권 등록 선택지를 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []).map(toLessonTicketRegistrationStudentOption);
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

export async function registerLessonTicketGrant(
  supabase: LessonTicketGrantRegistrationSupabaseClient,
  input: RegisterLessonTicketGrantInput,
): Promise<RegisterLessonTicketGrantResult> {
  const existingTicket = await fetchLatestLessonTicketGrant(supabase, input);
  const registered = registerLessonTicket(existingTicket?.ticket, input);
  const persistedTicket = existingTicket
    ? await updateLessonTicketGrant(
        supabase,
        existingTicket.ticketId,
        {
          ...registered.ticket,
          instrumentName: input.instrumentName,
        },
        input.paidAmount ?? 0,
      )
    : await insertLessonTicketGrant(
        supabase,
        {
          ...registered.ticket,
          instrumentName: input.instrumentName,
        },
        input.paidAmount ?? 0,
      );

  if (input.paidAmount && input.paidAmount > 0) {
    await insertLessonTicketIncomeLedger(supabase, input, persistedTicket.ticketId);
  }

  return {
    ticket: persistedTicket,
    event: registered.event,
  };
}

export function createLessonTicketListQueryOptions(
  supabase: LessonTicketListSupabaseClient,
  options: FetchLessonTicketListOptions,
) {
  return {
    queryKey: queryKeys.lessonTickets.list(options.academyId, {
      q: options.search,
      status: options.filters?.status,
    }),
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
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    registeredAt: row.registered_at,
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

async function insertLessonTicketIncomeLedger(
  supabase: LessonTicketGrantRegistrationSupabaseClient,
  input: RegisterLessonTicketGrantInput,
  ticketId: string,
) {
  const { error } = await supabase.from("ledger_entries").insert({
    academy_id: input.academyId,
    occurred_on: input.registeredAt,
    entry_type: "income",
    source: "lesson-ticket",
    amount: input.paidAmount,
    description: `${input.studentName} ${input.instrumentName} 회차권 ${input.grantedCount}회 구매`,
    ref_id: ticketId,
  });

  if (error) {
    throw new Error(`회차권 수입 내역을 저장하지 못했습니다: ${error.message}`);
  }
}

async function fetchLatestLessonTicketGrant(
  supabase: LessonTicketGrantRegistrationSupabaseClient,
  input: RegisterLessonTicketGrantInput,
) {
  const { data, error } = await supabase
    .from("lesson_ticket_grants")
    .select(LESSON_TICKET_LIST_SELECT)
    .eq("academy_id", input.academyId)
    .eq("student_id", input.studentId)
    .eq("instrument_id", input.instrumentId)
    .order("valid_until", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`기존 회차권을 확인하지 못했습니다: ${error.message}`);
  }

  const row = data?.[0];

  if (!row) {
    return undefined;
  }

  return {
    ticketId: row.id,
    ticket: toLessonTicket(row),
  };
}

async function updateLessonTicketGrant(
  supabase: LessonTicketGrantRegistrationSupabaseClient,
  ticketId: string,
  ticket: LessonTicket & { instrumentName: string },
  paidAmount: number,
) {
  const { data, error } = await supabase
    .from("lesson_ticket_grants")
    .update(toLessonTicketGrantMutationRow(ticket, paidAmount))
    .eq("id", ticketId)
    .select(LESSON_TICKET_LIST_SELECT)
    .single();

  if (error) {
    throw new Error(`회차권을 갱신하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("회차권을 갱신했지만 반환된 데이터가 없습니다.");
  }

  return toLessonTicketListItem(data);
}

async function insertLessonTicketGrant(
  supabase: LessonTicketGrantRegistrationSupabaseClient,
  ticket: LessonTicket & { instrumentName: string },
  paidAmount: number,
) {
  const { data, error } = await supabase
    .from("lesson_ticket_grants")
    .insert(toLessonTicketGrantMutationRow(ticket, paidAmount))
    .select(LESSON_TICKET_LIST_SELECT)
    .single();

  if (error) {
    throw new Error(`회차권을 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("회차권을 등록했지만 반환된 데이터가 없습니다.");
  }

  return toLessonTicketListItem(data);
}

function toLessonTicket(row: LessonTicketGrantSupabaseRow): LessonTicket {
  return {
    academyId: row.academy_id,
    studentId: row.student_id,
    instrumentId: row.instrument_id,
    totalGrantedCount: row.total_granted_count,
    remainingCount: row.remaining_count,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    registeredAt: row.registered_at,
  };
}

function toLessonTicketGrantMutationRow(
  ticket: LessonTicket & { instrumentName: string },
  paidAmount: number,
) {
  return {
    academy_id: ticket.academyId,
    student_id: ticket.studentId,
    instrument_id: ticket.instrumentId,
    instrument_name: ticket.instrumentName,
    total_granted_count: ticket.totalGrantedCount,
    remaining_count: ticket.remainingCount,
    valid_from: ticket.validFrom,
    valid_until: ticket.validUntil,
    registered_at: ticket.registeredAt,
    paid_amount: paidAmount,
    paid_at: paidAmount > 0 ? ticket.registeredAt : null,
  };
}
