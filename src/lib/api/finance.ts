import type { LedgerCategory, LedgerEntry } from "@/domain/book-sale";
import {
  buildFinanceLedgerList,
  toDefaultLedgerCategory,
  type BuildFinanceLedgerListOptions,
} from "@/domain/finance-ledger";

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

type FinanceLedgerListSelectBuilder = {
  eq(
    column: "academy_id",
    value: string,
  ): PromiseLike<SupabaseQueryResult<LedgerEntrySupabaseRow[]>>;
};

type FinanceLedgerListFromBuilder = {
  select(select: string): FinanceLedgerListSelectBuilder;
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
        ): PromiseLike<SupabaseQueryResult<null>>;
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
  const { data, error } = await supabase
    .from("ledger_entries")
    .select(FINANCE_LEDGER_LIST_SELECT)
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`입출입 내역을 불러오지 못했습니다: ${error.message}`);
  }

  return buildFinanceLedgerList((data ?? []).map(toLedgerEntry), options);
}

export function createFinanceLedgerListQueryOptions(
  supabase: FinanceLedgerListSupabaseClient,
  options: FetchFinanceLedgerListOptions,
) {
  return {
    queryKey: queryKeys.finance.ledgerList(options.academyId, {
      q: options.search,
      type: options.filters?.type,
      source: options.filters?.source,
      category: options.filters?.category,
      from: options.dateRange?.from,
      to: options.dateRange?.to,
      sort: options.sort ? `${options.sort.field}-${options.sort.direction}` : "",
    }),
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
  const { error } = await supabase
    .from("ledger_entries")
    .delete()
    .eq("id", input.ledgerId)
    .eq("academy_id", input.academyId);

  if (error) {
    throw new Error(`입출금 내역을 삭제하지 못했습니다: ${error.message}`);
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
