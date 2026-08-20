import { describe, expect, it } from "vitest";

import {
  createFinanceLedgerListQueryOptions,
  fetchFinanceLedgerList,
  type FinanceLedgerListSupabaseClient,
  type LedgerEntrySupabaseRow,
} from "./finance";

function createSupabaseStub(
  rows: LedgerEntrySupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
    [];
  const client: FinanceLedgerListSupabaseClient = {
    from(table) {
      calls.push({ table });

      return {
        select(select) {
          calls[calls.length - 1].select = select;

          return {
            async eq(column, value) {
              calls[calls.length - 1].eq = [column, value];

              return {
                data: error ? null : rows,
                error,
              };
            },
          };
        },
      };
    },
  };

  return { client, calls };
}

describe("fetchFinanceLedgerList", () => {
  it("Supabase ledger_entries row를 입출입 내역으로 변환하고 academy_id로 제한한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "ledger-1",
        academy_id: "academy-1",
        occurred_on: "2026-08-21",
        entry_type: "expense",
        source: "manual",
        amount: 30000,
        description: "조율비",
        ref_id: "manual-1",
      },
    ]);

    const result = await fetchFinanceLedgerList(client, {
      academyId: "academy-1",
      search: "조율",
    });

    expect(calls).toEqual([
      {
        table: "ledger_entries",
        select:
          "id, academy_id, occurred_on, entry_type, source, amount, description, ref_id",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result[0]).toMatchObject({
      academyId: "academy-1",
      ledgerId: "ledger-1",
      occurredOn: "2026-08-21",
      type: "expense",
      source: "manual",
      amount: 30000,
      description: "조율비",
      refId: "manual-1",
    });
  });

  it("Supabase 오류는 사용자에게 전달 가능한 오류로 변환한다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(
      fetchFinanceLedgerList(client, {
        academyId: "academy-1",
      }),
    ).rejects.toThrow("입출입 내역을 불러오지 못했습니다: permission denied");
  });
});

describe("createFinanceLedgerListQueryOptions", () => {
  it("학원 범위와 검색/필터를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createFinanceLedgerListQueryOptions(client, {
      academyId: "academy-1",
      search: "조율",
      filters: {
        type: "expense",
        source: "manual",
      },
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "finance",
      "ledger-list",
      "조율",
      "expense",
      "manual",
    ]);
    await expect(options.queryFn()).resolves.toEqual([]);
  });
});
