import { describe, expect, it } from "vitest";

import {
  createVendorListQueryOptions,
  fetchVendorList,
  type VendorListSupabaseClient,
  type VendorSupabaseRow,
} from "./vendors";

function createSupabaseStub(
  rows: VendorSupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
    [];
  const client: VendorListSupabaseClient = {
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

describe("fetchVendorList", () => {
  it("Supabase 거래처 row를 도메인 목록으로 변환하고 academy_id로 제한한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "vendor-1",
        academy_id: "academy-1",
        name: "예음문구",
        phone: "02-111-1111",
        vendor_type: "교재",
        note: "바이엘 재고 확인",
      },
    ]);

    const result = await fetchVendorList(client, {
      academyId: "academy-1",
      search: "교재",
    });

    expect(calls).toEqual([
      {
        table: "vendors",
        select: "id, academy_id, name, phone, vendor_type, note",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result.items[0]).toMatchObject({
      academyId: "academy-1",
      vendorId: "vendor-1",
      name: "예음문구",
      contact: "02-111-1111",
      kind: "교재",
      memo: "바이엘 재고 확인",
    });
  });

  it("Supabase 오류는 사용자에게 전달 가능한 오류로 변환한다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(
      fetchVendorList(client, {
        academyId: "academy-1",
      }),
    ).rejects.toThrow("거래처 목록을 불러오지 못했습니다: permission denied");
  });
});

describe("createVendorListQueryOptions", () => {
  it("학원 범위와 검색/필터를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createVendorListQueryOptions(client, {
      academyId: "academy-1",
      search: "문구",
      filters: {
        kind: "교재",
      },
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "vendors",
      "list",
      "문구",
      "교재",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });
});
