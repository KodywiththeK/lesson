import type { LedgerCategory, LedgerEntry } from "@/domain/book-sale";
import {
  buildFinanceLedgerList,
  toDefaultLedgerCategory,
  type BuildFinanceLedgerListOptions,
} from "@/domain/finance-ledger";

import { fetchAllRows, type PagedSelectQuery } from "./paged-query";
import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type LedgerEntrySupabaseRow = {
  id: string;
  academy_id: string;
  occurred_on: string;
  entry_type: LedgerEntry["type"];
  source: LedgerEntry["source"];
  category?: LedgerCategory | null;
  amount: number;
  description: string;
  ref_id: string | null;
};

type FinanceLedgerListFromBuilder = {
  select(select: string): PagedSelectQuery<LedgerEntrySupabaseRow>;
};

export type FinanceLedgerListSupabaseClient = {
  from(table: "ledger_entries"): FinanceLedgerListFromBuilder;
};

export type FetchFinanceLedgerListOptions = BuildFinanceLedgerListOptions;

export type RegisterManualLedgerEntryInput = {
  academyId: string;
  occurredOn: string;
  type: LedgerEntry["type"];
  category?: LedgerCategory;
  amount: number;
  description: string;
};

export type UpdateFinanceLedgerEntryInput = {
  ledgerId: string;
  academyId: string;
  occurredOn: string;
  type: LedgerEntry["type"];
  source: LedgerEntry["source"];
  category: LedgerCategory;
  amount: number;
  description: string;
};

export type DeleteFinanceLedgerEntryInput = {
  ledgerId: string;
  academyId: string;
};

export type FinanceLedgerCreateSupabaseClient = {
  from(table: "ledger_entries"): {
    insert(values: Record<string, unknown>): {
      select(select: string): {
        single(): PromiseLike<SupabaseQueryResult<LedgerEntrySupabaseRow>>;
      };
    };
  };
};

export type FinanceLedgerUpdateSupabaseClient = {
  from(table: "ledger_entries"): {
    update(values: Record<string, unknown>): {
      eq(column: "id" | "academy_id", value: string): {
        eq(column: "id" | "academy_id", value: string): {
          select(select: string): {
            single(): PromiseLike<SupabaseQueryResult<LedgerEntrySupabaseRow>>;
          };
        };
        select(select: string): {
          single(): PromiseLike<SupabaseQueryResult<LedgerEntrySupabaseRow>>;
        };
      };
    };
  };
};

export type FinanceLedgerDeleteSupabaseClient = {
  from(table: "ledger_entries"): {
    delete(): {
      eq(column: "id" | "academy_id", value: string): {
        eq(
          column: "id" | "academy_id",
          value: string,
        ): {
          select(select: "id"): PromiseLike<SupabaseQueryResult<Array<{ id: string }>>>;
        };
      };
    };
  };
};

export type FinanceLedgerMutationSupabaseClient =
  FinanceLedgerCreateSupabaseClient &
  FinanceLedgerUpdateSupabaseClient &
  FinanceLedgerDeleteSupabaseClient;

const FINANCE_LEDGER_LIST_SELECT =
  "id, academy_id, occurred_on, entry_type, source, category, amount, description, ref_id";

export async function fetchFinanceLedgerList(
  supabase: FinanceLedgerListSupabaseClient,
  options: FetchFinanceLedgerListOptions,
): Promise<LedgerEntry[]> {
  // 기간은 서버에서 거르고(월 합계가 1000행 제한에 잘리지 않게), 화면 필터는 buildFinanceLedgerList가 한 번 더 건다.
  const rows = await fetchAllRows("입출입 내역을 불러오지 못했습니다", (from, to) => {
    const query = supabase
      .from("ledger_entries")
      .select(FINANCE_LEDGER_LIST_SELECT)
      .eq("academy_id", options.academyId);
    const ranged = options.dateRange
      ? query.gte("occurred_on", options.dateRange.from).lte("occurred_on", options.dateRange.to)
      : query;
    // 출처 필터도 서버에서 건다(가져올 행 수를 줄이고, 월과 무관하게 한 출처만 읽을 수 있다).
    const sourced = options.filters?.source ? ranged.eq("source", options.filters.source) : ranged;

    return sourced
      .order("occurred_on", { ascending: false })
      .order("id")
      .range(from, to);
  });

  return buildFinanceLedgerList(rows.map(toLedgerEntry), options);
}

export function buildFinanceLedgerListQueryKey(options: FetchFinanceLedgerListOptions) {
  return queryKeys.finance.ledgerList(options.academyId, {
    q: options.search,
    type: options.filters?.type,
    source: options.filters?.source,
    category: options.filters?.category,
    from: options.dateRange?.from,
    to: options.dateRange?.to,
    sort: options.sort ? `${options.sort.field}-${options.sort.direction}` : "",
  });
}

export function createFinanceLedgerListQueryOptions(
  supabase: FinanceLedgerListSupabaseClient,
  options: FetchFinanceLedgerListOptions,
) {
  return {
    queryKey: buildFinanceLedgerListQueryKey(options),
    queryFn: () => fetchFinanceLedgerList(supabase, options),
  };
}

export async function registerManualLedgerEntry(
  supabase: FinanceLedgerMutationSupabaseClient,
  input: RegisterManualLedgerEntryInput,
): Promise<LedgerEntry> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      academy_id: input.academyId,
      occurred_on: input.occurredOn,
      entry_type: input.type,
      source: "manual",
      category: input.category ?? "other",
      amount: input.amount,
      description: input.description,
    })
    .select(FINANCE_LEDGER_LIST_SELECT)
    .single();

  if (error) {
    throw new Error(`수동 입출입을 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("수동 입출입을 등록했지만 반환된 데이터가 없습니다.");
  }

  return toLedgerEntry(data);
}

export async function updateFinanceLedgerEntry(
  supabase: FinanceLedgerUpdateSupabaseClient,
  input: UpdateFinanceLedgerEntryInput,
): Promise<LedgerEntry> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .update({
      occurred_on: input.occurredOn,
      entry_type: input.type,
      source: input.source,
      category: input.category,
      amount: input.amount,
      description: input.description,
    })
    .eq("id", input.ledgerId)
    .eq("academy_id", input.academyId)
    .select(FINANCE_LEDGER_LIST_SELECT)
    .single();

  if (error) {
    throw new Error(`입출금 내역을 수정하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("입출금 내역을 수정했지만 반환된 데이터가 없습니다.");
  }

  return toLedgerEntry(data);
}

export async function deleteFinanceLedgerEntry(
  supabase: FinanceLedgerDeleteSupabaseClient,
  input: DeleteFinanceLedgerEntryInput,
): Promise<void> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .delete()
    .eq("id", input.ledgerId)
    .eq("academy_id", input.academyId)
    .select("id");

  if (error) {
    throw new Error(`입출금 내역을 삭제하지 못했습니다: ${error.message}`);
  }

  // RLS나 이미 지워진 행은 오류 없이 0건 삭제로 끝나므로, 지워진 행이 있는지 확인한다.
  if (!data?.length) {
    throw new Error("이미 삭제되었거나 찾을 수 없는 내역입니다.");
  }
}

function toLedgerEntry(row: LedgerEntrySupabaseRow): LedgerEntry {
  return {
    academyId: row.academy_id,
    ledgerId: row.id,
    occurredOn: row.occurred_on,
    type: row.entry_type,
    source: row.source,
    category: row.category ?? toDefaultLedgerCategory(row.source),
    amount: row.amount,
    description: row.description,
    refId: row.ref_id ?? row.id,
  };
}
