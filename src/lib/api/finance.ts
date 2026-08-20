import type { LedgerEntry } from "@/domain/book-sale";
import {
  buildFinanceLedgerList,
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

const FINANCE_LEDGER_LIST_SELECT =
  "id, academy_id, occurred_on, entry_type, source, amount, description, ref_id";

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
    }),
    queryFn: () => fetchFinanceLedgerList(supabase, options),
  };
}

function toLedgerEntry(row: LedgerEntrySupabaseRow): LedgerEntry {
  return {
    academyId: row.academy_id,
    ledgerId: row.id,
    occurredOn: row.occurred_on,
    type: row.entry_type,
    source: row.source,
    amount: row.amount,
    description: row.description,
    refId: row.ref_id ?? row.id,
  };
}
