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
import { createFakeSupabase } from "./test-support/fake-supabase";

const ledgerRow = (index: number): LedgerEntrySupabaseRow => ({
  id: `ledger-${String(index).padStart(4, "0")}`,
  academy_id: "academy-1",
  occurred_on: "2026-08-21",
  entry_type: "income",
  source: "manual",
  category: "other",
  amount: 1000,
  description: `수입${index}`,
  ref_id: null,
});

function createSupabaseStub(
  rows: LedgerEntrySupabaseRow[],
  error: Error | null = null,
) {
  const fake = createFakeSupabase(
    { ledger_entries: rows },
    error ? { errors: { ledger_entries: error } } : {},
  );

  return {
    client: fake.client as unknown as FinanceLedgerListSupabaseClient,
    queries: fake.queries,
  };
}

describe("fetchFinanceLedgerList", () => {
  it("Supabase ledger_entries row를 입출입 내역으로 변환하고 academy_id로 제한한다", async () => {
    const { client, queries } = createSupabaseStub([
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

    expect(queries).toEqual([
      expect.objectContaining({
        table: "ledger_entries",
        select:
          "id, academy_id, occurred_on, entry_type, source, category, amount, description, ref_id",
        eq: [["academy_id", "academy-1"]],
      }),
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

  it("기간이 있으면 서버에서 occurred_on 범위로 거르고 최신순·id순으로 고정해 읽는다", async () => {
    const { client, queries } = createSupabaseStub([ledgerRow(1)]);

    await fetchFinanceLedgerList(client, {
      academyId: "academy-1",
      dateRange: { from: "2026-08-01", to: "2026-08-31" },
    });

    expect(queries[0]).toMatchObject({
      eq: [["academy_id", "academy-1"]],
      gte: [["occurred_on", "2026-08-01"]],
      lte: [["occurred_on", "2026-08-31"]],
      order: [
        ["occurred_on", { ascending: false }],
        ["id", undefined],
      ],
      range: [[0, 999]],
    });
  });

  it("기간이 없어도 순서를 고정하고 범위 조건 없이 읽는다", async () => {
    const { client, queries } = createSupabaseStub([ledgerRow(1)]);

    await fetchFinanceLedgerList(client, { academyId: "academy-1" });

    expect(queries[0].gte).toEqual([]);
    expect(queries[0].lte).toEqual([]);
    expect(queries[0].order).toEqual([
      ["occurred_on", { ascending: false }],
      ["id", undefined],
    ]);
  });

  it("1000건을 넘는 원장도 range로 끝까지 읽어 조용히 잘리지 않는다", async () => {
    const rows = Array.from({ length: 1200 }, (_, index) => ledgerRow(index));
    const { client, queries } = createSupabaseStub(rows);

    const result = await fetchFinanceLedgerList(client, {
      academyId: "academy-1",
      dateRange: { from: "2026-08-01", to: "2026-08-31" },
    });

    expect(result).toHaveLength(1200);
    expect(queries.map((query) => query.range[0])).toEqual([[0, 999], [1000, 1999]]);
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

  function createDeleteClient(
    result: { data: Array<{ id: string }> | null; error: Error | null },
    calls: Array<Record<string, unknown>> = [],
  ): FinanceLedgerDeleteSupabaseClient {
    return {
      from(table: "ledger_entries") {
        calls.push({ table });

        return {
          delete() {
            calls.push({ delete: true });

            const filterBuilder = {
              eq(column: string, value: string) {
                calls.push({ eq: [column, value] });

                return {
                  select(select: string) {
                    calls.push({ select });

                    return Promise.resolve(result);
                  },
                };
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
  }

  it("id와 academy_id 기준으로 입출금 내역을 삭제하고 삭제된 행을 확인한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createDeleteClient({ data: [{ id: "ledger-1" }], error: null }, calls);

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
      { select: "id" },
    ]);
  });

  it("삭제된 행이 없으면 이미 삭제되었거나 찾을 수 없다고 알린다", async () => {
    const client = createDeleteClient({ data: [], error: null });

    await expect(
      deleteFinanceLedgerEntry(client, { ledgerId: "ledger-1", academyId: "academy-1" }),
    ).rejects.toThrow("이미 삭제되었거나 찾을 수 없는 내역입니다.");
  });

  it("삭제 중 Supabase 오류가 나면 입출금 삭제 실패로 알린다", async () => {
    const client = createDeleteClient({ data: null, error: new Error("permission denied") });

    await expect(
      deleteFinanceLedgerEntry(client, { ledgerId: "ledger-1", academyId: "academy-1" }),
    ).rejects.toThrow("입출금 내역을 삭제하지 못했습니다: permission denied");
  });
});
