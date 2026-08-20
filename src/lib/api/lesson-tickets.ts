import {
  buildLessonTicketList,
  type BuildLessonTicketListOptions,
  type LessonTicketListItem,
  type LessonTicketListRow,
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

const LESSON_TICKET_LIST_SELECT =
  "id, academy_id, student_id, instrument_id, instrument_name, total_granted_count, remaining_count, valid_from, valid_until, registered_at, students(name)";

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
