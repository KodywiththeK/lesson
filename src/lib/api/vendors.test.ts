import { describe, expect, it } from "vitest";

import {
  createVendorListQueryOptions,
  deleteVendor,
  fetchVendorList,
  registerVendor,
  updateVendor,
  type VendorListSupabaseClient,
  type VendorMutationSupabaseClient,
  type VendorSupabaseRow,
} from "./vendors";
import { createFakeSupabase, createNumberedRows } from "./test-support/fake-supabase";

const VENDOR_SELECT = "id, academy_id, name, phone, vendor_type, note";

function createSupabaseStub(
  rows: VendorSupabaseRow[],
  error: Error | null = null,
) {
  const fake = createFakeSupabase(
    { vendors: rows },
    error ? { errors: { vendors: error } } : {},
  );

  return {
    client: fake.client as unknown as VendorListSupabaseClient,
    calls: fake.queries,
  };
}

type MutationCall = {
  table: string;
  insert?: Record<string, unknown>;
  update?: Record<string, unknown>;
  eq: Array<[string, string]>;
  select?: string;
};

function createMutationStub(
  result: { data: VendorSupabaseRow | null; error: Error | null },
) {
  const calls: MutationCall[] = [];
  const client: VendorMutationSupabaseClient = {
    rpc: async () => ({ data: null, error: null }),
    from(table) {
      const call: MutationCall = { table, eq: [] };
      calls.push(call);

      const selectBuilder = {
        select(select: string) {
          call.select = select;

          return { single: async () => result };
        },
      };
      const updateFilter = {
        eq(column: string, value: string) {
          call.eq.push([column, value]);

          return call.eq.length < 2 ? updateFilter : selectBuilder;
        },
      };

      return {
        insert(values: Record<string, unknown>) {
          call.insert = values;

          return selectBuilder;
        },
        update(values: Record<string, unknown>) {
          call.update = values;

          return updateFilter;
        },
      } as ReturnType<VendorMutationSupabaseClient["from"]>;
    },
  };

  return { client, calls };
}

const savedVendorRow: VendorSupabaseRow = {
  id: "vendor-1",
  academy_id: "academy-1",
  name: "예음문구",
  phone: "02-111-1111",
  vendor_type: "교재",
  note: "바이엘 재고 확인",
};

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

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      table: "vendors",
      select: "id, academy_id, name, phone, vendor_type, note",
      eq: [["academy_id", "academy-1"]],
      // 서버 1000건 제한에 조용히 잘리지 않도록 순서를 고정하고 range로 읽는다.
      order: [["name", undefined], ["id", undefined]],
      range: [[0, 999]],
    });
    expect(result.items[0]).toMatchObject({
      academyId: "academy-1",
      vendorId: "vendor-1",
      name: "예음문구",
      contact: "02-111-1111",
      kind: "교재",
      memo: "바이엘 재고 확인",
    });
  });

  it("1000건을 넘는 거래처도 range를 이어 끝까지 읽는다", async () => {
    const { client, calls } = createSupabaseStub(
      createNumberedRows(1200, (index) => ({
        id: `vendor-${index}`,
        academy_id: "academy-1",
        name: `거래처${index}`,
        phone: null,
        vendor_type: "교재",
        note: null,
      })) as VendorSupabaseRow[],
    );

    const result = await fetchVendorList(client, { academyId: "academy-1", pageSize: 10 });

    expect(result.totalItems).toBe(1200);
    expect(calls[0].range).toEqual([[0, 999]]);
    expect(calls.map((call) => call.range[0])).toEqual([[0, 999], [1000, 1999]]);
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
  it("학원 범위와 검색/필터/페이지를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createVendorListQueryOptions(client, {
      academyId: "academy-1",
      search: "문구",
      filters: {
        kind: "교재",
      },
      page: 2,
      pageSize: 20,
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "vendors",
      "list",
      "문구",
      "교재",
      "2",
      "20",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });
});

describe("registerVendor", () => {
  it("연락처와 비고가 비어 있으면 null로 저장하고 학원 범위를 함께 보낸다", async () => {
    const { client, calls } = createMutationStub({
      data: { ...savedVendorRow, phone: null, note: null },
      error: null,
    });

    const result = await registerVendor(client, {
      academyId: "academy-1",
      name: "예음문구",
      contact: "",
      kind: "교재",
      memo: "",
    });

    expect(calls).toEqual([
      {
        table: "vendors",
        insert: {
          academy_id: "academy-1",
          name: "예음문구",
          phone: null,
          vendor_type: "교재",
          note: null,
        },
        eq: [],
        select: VENDOR_SELECT,
      },
    ]);
    expect(result).toEqual({
      academyId: "academy-1",
      vendorId: "vendor-1",
      name: "예음문구",
      contact: "",
      kind: "교재",
      memo: "",
    });
  });

  it("Supabase 오류는 등록 실패 문구로 감싸 전달한다", async () => {
    const { client } = createMutationStub({
      data: null,
      error: new Error("permission denied"),
    });

    await expect(
      registerVendor(client, {
        academyId: "academy-1",
        name: "예음문구",
        contact: "",
        kind: "교재",
        memo: "",
      }),
    ).rejects.toThrow("거래처를 등록하지 못했습니다: permission denied");
  });
});

describe("updateVendor", () => {
  it("academy_id와 id로 대상을 좁혀 거래처 정보만 수정하고 수정된 목록 행을 돌려준다", async () => {
    const { client, calls } = createMutationStub({
      data: { ...savedVendorRow, name: "예음악기", note: null },
      error: null,
    });

    const result = await updateVendor(client, {
      academyId: "academy-1",
      vendorId: "vendor-1",
      name: "예음악기",
      contact: "02-111-1111",
      kind: "교재",
      memo: "",
    });

    expect(calls).toEqual([
      {
        table: "vendors",
        update: {
          name: "예음악기",
          phone: "02-111-1111",
          vendor_type: "교재",
          note: null,
        },
        eq: [
          ["academy_id", "academy-1"],
          ["id", "vendor-1"],
        ],
        select: VENDOR_SELECT,
      },
    ]);
    expect(result).toEqual({
      academyId: "academy-1",
      vendorId: "vendor-1",
      name: "예음악기",
      contact: "02-111-1111",
      kind: "교재",
      memo: "",
    });
  });

  it("Supabase 오류는 수정 실패 문구로 감싸 전달한다", async () => {
    const { client } = createMutationStub({
      data: null,
      error: new Error("permission denied"),
    });

    await expect(
      updateVendor(client, {
        academyId: "academy-1",
        vendorId: "vendor-1",
        name: "예음문구",
        contact: "",
        kind: "교재",
        memo: "",
      }),
    ).rejects.toThrow("거래처를 수정하지 못했습니다: permission denied");
  });

  it("수정 결과가 비어 있으면 저장 여부를 확인하도록 오류를 던진다", async () => {
    const { client } = createMutationStub({ data: null, error: null });

    await expect(
      updateVendor(client, {
        academyId: "academy-1",
        vendorId: "vendor-1",
        name: "예음문구",
        contact: "",
        kind: "교재",
        memo: "",
      }),
    ).rejects.toThrow("거래처를 수정했지만 반환된 데이터가 없습니다.");
  });
});

describe("deleteVendor", () => {
  it("삭제 RPC에 학원과 거래처를 넘긴다", async () => {
    const calls: Array<{ name: string; payload: unknown }> = [];
    const client = {
      rpc(name: string, payload: unknown) {
        calls.push({ name, payload });
        return Promise.resolve({ data: null, error: null });
      },
    } as unknown as VendorMutationSupabaseClient;

    await deleteVendor(client, { academyId: "academy-1", vendorId: "vendor-1" });

    expect(calls).toEqual([
      { name: "delete_vendor", payload: { p_academy_id: "academy-1", p_vendor_id: "vendor-1" } },
    ]);
  });

  it("실패하면 사용자에게 보일 문구로 던진다", async () => {
    const client = {
      rpc: () => Promise.resolve({ data: null, error: new Error("권한이 없습니다.") }),
    } as unknown as VendorMutationSupabaseClient;

    await expect(
      deleteVendor(client, { academyId: "academy-1", vendorId: "vendor-1" }),
    ).rejects.toThrow("거래처를 삭제하지 못했습니다: 권한이 없습니다.");
  });
});
