import { getConsultationRetentionCutoff, type ConsultationProfile } from "@/domain/consultation";
import {
  buildConsultationList,
  type BuildConsultationListOptions,
  type ConsultationListRow,
} from "@/domain/consultation-list";
import type { ListView } from "@/domain/common-list";

import { fetchAllRows, type PagedSelectQuery } from "./paged-query";
import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type ConsultationSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  age: number | null;
  instrument_names: string[];
  phone: string;
  school: string | null;
  memo: string | null;
  created_at: string;
};

export type ConsultationListSupabaseClient = {
  from(table: "consultations"): {
    select(select: string): PagedSelectQuery<ConsultationSupabaseRow>;
  };
};

type ConsultationRowBuilder = {
  select(select: string): {
    single(): PromiseLike<SupabaseQueryResult<ConsultationSupabaseRow>>;
  };
};

type ConsultationScopedFilter<TNext> = {
  eq(column: "academy_id", value: string): { eq(column: "id", value: string): TNext };
};

export type ConsultationMutationSupabaseClient = {
  from(table: "consultations"): {
    insert(values: Record<string, unknown>): ConsultationRowBuilder;
    update(values: Record<string, unknown>): ConsultationScopedFilter<ConsultationRowBuilder>;
    delete(): ConsultationScopedFilter<{
      select(select: "id"): PromiseLike<SupabaseQueryResult<Array<{ id: string }>>>;
    }>;
  };
};

export type FetchConsultationListOptions = BuildConsultationListOptions;

export type RegisterConsultationInput = ConsultationProfile & { academyId: string };
export type UpdateConsultationInput = RegisterConsultationInput & { consultationId: string };
export type DeleteConsultationInput = { academyId: string; consultationId: string };

const CONSULTATION_SELECT =
  "id, academy_id, name, age, instrument_names, phone, school, memo, created_at";

/**
 * 보관 기간(접수일로부터 1년) 안의 상담만 읽는다. 만료된 행은 DB 정리 작업이 지우지만,
 * 정리 전에도 화면에 나오지 않도록 조회에서도 한 번 더 거른다.
 */
export async function fetchConsultationList(
  supabase: ConsultationListSupabaseClient,
  options: FetchConsultationListOptions,
  now: Date = new Date(),
): Promise<ListView<ConsultationListRow>> {
  const retentionCutoff = getConsultationRetentionCutoff(now);
  const rows = await fetchAllRows("상담 목록을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("consultations")
      .select(CONSULTATION_SELECT)
      .eq("academy_id", options.academyId)
      .gte("created_at", retentionCutoff)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  return buildConsultationList(rows.map(toConsultationListRow), options);
}

export function createConsultationListQueryKey(options: FetchConsultationListOptions) {
  return queryKeys.consultations.list(options.academyId, {
    q: options.search,
    instrumentName: options.filters?.instrumentName,
    page: options.page?.toString(),
    pageSize: options.pageSize?.toString(),
  });
}

export async function registerConsultation(
  supabase: ConsultationMutationSupabaseClient,
  input: RegisterConsultationInput,
): Promise<ConsultationListRow> {
  const { data, error } = await supabase
    .from("consultations")
    .insert({ academy_id: input.academyId, ...toConsultationWriteValues(input) })
    .select(CONSULTATION_SELECT)
    .single();

  if (error) {
    throw new Error(`상담을 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("상담을 등록했지만 반환된 데이터가 없습니다.");
  }

  return toConsultationListRow(data);
}

export async function updateConsultation(
  supabase: ConsultationMutationSupabaseClient,
  input: UpdateConsultationInput,
): Promise<ConsultationListRow> {
  const { data, error } = await supabase
    .from("consultations")
    .update(toConsultationWriteValues(input))
    .eq("academy_id", input.academyId)
    .eq("id", input.consultationId)
    .select(CONSULTATION_SELECT)
    .single();

  if (error) {
    throw new Error(`상담을 수정하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("상담을 수정했지만 반환된 데이터가 없습니다.");
  }

  return toConsultationListRow(data);
}

/** RLS가 막거나 이미 지워진 행은 오류 없이 0건이 지워지므로, 실제로 지워졌는지 확인한다. */
export async function deleteConsultation(
  supabase: ConsultationMutationSupabaseClient,
  input: DeleteConsultationInput,
): Promise<void> {
  const { data, error } = await supabase
    .from("consultations")
    .delete()
    .eq("academy_id", input.academyId)
    .eq("id", input.consultationId)
    .select("id");

  if (error) {
    throw new Error(`상담 기록을 삭제하지 못했습니다: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("상담 기록을 삭제하지 못했습니다: 이미 삭제되었거나 삭제할 권한이 없습니다.");
  }
}

function toConsultationWriteValues(profile: ConsultationProfile) {
  return {
    name: profile.name,
    age: profile.age ?? null,
    instrument_names: profile.instrumentNames,
    phone: profile.phone,
    school: profile.school || null,
    memo: profile.memo || null,
  };
}

function toConsultationListRow(row: ConsultationSupabaseRow): ConsultationListRow {
  return {
    academyId: row.academy_id,
    consultationId: row.id,
    name: row.name,
    age: row.age ?? undefined,
    instrumentNames: row.instrument_names,
    phone: row.phone,
    school: row.school ?? "",
    memo: row.memo ?? "",
    receivedAt: row.created_at,
  };
}
