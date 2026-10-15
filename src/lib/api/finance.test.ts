import { describe, expect, it } from "vitest";

import {
  createFinanceLedgerListQueryOptions,
  deleteFinanceLedgerEntry,
  fetchFinanceLedgerList,
  updateFinanceLedgerEntry,
  type FinanceLedgerDeleteSupabaseClient,
  type FinanceLedgerListSupabaseClient,
  type FinanceLedgerUpdateSupabaseClient,
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
        category: "tuning-repair",
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
          "id, academy_id, occurred_on, entry_type, source, category, amount, description, ref_id",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result[0]).toMatchObject({
      academyId: "academy-1",
      ledgerId: "ledger-1",
      occurredOn: "2026-08-21",
      type: "expense",
      source: "manual",
      category: "tuning-repair",
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
  it("학원 범위와 검색/필터를 queryKey와 queryFn에 함께 묶고 페이지 칸은 비워 둔다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createFinanceLedgerListQueryOptions(client, {
      academyId: "academy-1",
      search: "조율",
      filters: {
        type: "expense",
        source: "manual",
        category: "tuning-repair",
      },
      dateRange: {
        from: "2026-08-01",
        to: "2026-08-31",
      },
      sort: {
        field: "amount",
        direction: "desc",
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
      "tuning-repair",
      "2026-08-01",
      "2026-08-31",
      "amount-desc",
      "",
      "",
    ]);
    await expect(options.queryFn()).resolves.toEqual([]);
  });
});

describe("finance ledger mutations", () => {
  it("id와 academy_id 기준으로 입출금 내역을 수정하고 갱신된 row를 반환한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client: FinanceLedgerUpdateSupabaseClient = {
      from(table: "ledger_entries") {
        calls.push({ table });

        return {
          update(values: Record<string, unknown>) {
            calls.push({ update: values });

            const filterBuilder = {
              eq(column: string, value: string) {
                calls.push({ eq: [column, value] });

                return filterBuilder;
              },
              select(select: string) {
                calls.push({ select });

                return {
                  async single() {
                    return {
                      data: {
                        id: "ledger-1",
                        academy_id: "academy-1",
                        occurred_on: "2026-08-21",
                        entry_type: "expense" as const,
                        source: "manual" as const,
                        category: "supplies" as const,
                        amount: 45000,
                        description: "현악기 줄 교체비",
                        ref_id: "manual-1",
                      },
                      error: null,
                    };
                  },
                };
              },
            };

            return filterBuilder;
          },
        };
      },
    };

    await expect(
      updateFinanceLedgerEntry(client, {
        ledgerId: "ledger-1",
        academyId: "academy-1",
        occurredOn: "2026-08-21",
        type: "expense",
        source: "manual",
        category: "supplies",
        amount: 45000,
        description: "현악기 줄 교체비",
      }),
    ).resolves.toMatchObject({
      ledgerId: "ledger-1",
      category: "supplies",
      amount: 45000,
    });
    expect(calls).toContainEqual({ eq: ["id", "ledger-1"] });
    expect(calls).toContainEqual({ eq: ["academy_id", "academy-1"] });
    expect(calls).not.toContainEqual({
      update: expect.objectContaining({ academy_id: "academy-1" }),
    });
  });

  it("id와 academy_id 기준으로 입출금 내역을 삭제한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client: FinanceLedgerDeleteSupabaseClient = {
      from(table: "ledger_entries") {
        calls.push({ table });

        return {
          delete() {
            calls.push({ delete: true });

            const filterBuilder = {
              eq(column: string, value: string) {
                calls.push({ eq: [column, value] });

                return Promise.resolve({ data: null, error: null });
              },
            };

            return {
              eq(column: string, value: string) {
                calls.push({ eq: [column, value] });

                return filterBuilder;
              },
            };
          },
        };
      },
    };

    await expect(
      deleteFinanceLedgerEntry(client, {
        ledgerId: "ledger-1",
        academyId: "academy-1",
      }),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([
      { table: "ledger_entries" },
      { delete: true },
      { eq: ["id", "ledger-1"] },
      { eq: ["academy_id", "academy-1"] },
    ]);
  });
});
