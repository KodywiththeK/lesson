import { describe, expect, it } from "vitest";

import {
  createConsultationListQueryKey,
  deleteConsultation,
  fetchConsultationList,
  registerConsultation,
  updateConsultation,
  type ConsultationListSupabaseClient,
  type ConsultationMutationSupabaseClient,
  type ConsultationSupabaseRow,
} from "./consultations";
import { createFakeSupabase, createNumberedRows } from "./test-support/fake-supabase";

const CONSULTATION_SELECT =
  "id, academy_id, name, age, instrument_names, phone, school, memo, created_at";
const NOW = new Date("2026-10-16T03:00:00.000Z");

function consultationRow(overrides: Partial<ConsultationSupabaseRow> = {}): ConsultationSupabaseRow {
  return {
    id: "consultation-1",
    academy_id: "academy-1",
    name: "김하늘",
    age: 9,
    instrument_names: ["피아노", "첼로"],
    phone: "010-1111-2222",
    school: "새봄초",
    memo: "화요일 선호",
    created_at: "2026-10-10T01:00:00+00:00",
    ...overrides,
  };
}

function createListStub(rows: ConsultationSupabaseRow[], error: Error | null = null) {
  const fake = createFakeSupabase(
    { consultations: rows },
    error ? { errors: { consultations: error } } : {},
  );

  return {
    client: fake.client as unknown as ConsultationListSupabaseClient,
    queries: fake.queries,
  };
}

describe("fetchConsultationList", () => {
  it("상담 row를 도메인 목록으로 바꾸고 학원·보관 기간 1년 이내·접수일 최신순으로 조회한다", async () => {
    const { client, queries } = createListStub([
      consultationRow(),
      consultationRow({ id: "consultation-2", school: null, memo: null, age: null, instrument_names: [] }),
    ]);

    const view = await fetchConsultationList(client, { academyId: "academy-1" }, NOW);

    expect(queries).toEqual([
      expect.objectContaining({
        table: "consultations",
        select: CONSULTATION_SELECT,
        eq: [["academy_id", "academy-1"]],
        gte: [["created_at", "2025-10-16T03:00:00.000Z"]],
        order: [
          ["created_at", { ascending: false }],
          ["id", undefined],
        ],
        range: [[0, 999]],
      }),
    ]);
    expect(view.items).toEqual([
      {
        academyId: "academy-1",
        consultationId: "consultation-1",
        name: "김하늘",
        age: 9,
        instrumentNames: ["피아노", "첼로"],
        phone: "010-1111-2222",
        school: "새봄초",
        memo: "화요일 선호",
        receivedAt: "2026-10-10T01:00:00+00:00",
      },
      {
        academyId: "academy-1",
        consultationId: "consultation-2",
        name: "김하늘",
        age: undefined,
        instrumentNames: [],
        phone: "010-1111-2222",
        school: "",
        memo: "",
        receivedAt: "2026-10-10T01:00:00+00:00",
      },
    ]);
  });

  it("검색·악기 필터·페이지를 받은 행에 적용해 총 건수와 함께 돌려준다", async () => {
    const { client } = createListStub(
      createNumberedRows(25, (index) =>
        consultationRow({
          id: `consultation-${String(index + 1).padStart(2, "0")}`,
          name: `상담${index + 1}`,
          instrument_names: index % 2 === 0 ? ["피아노"] : ["첼로"],
        }),
      ) as ConsultationSupabaseRow[],
    );

    const view = await fetchConsultationList(
      client,
      { academyId: "academy-1", filters: { instrumentName: "피아노" }, page: 2, pageSize: 10 },
      NOW,
    );

    expect(view).toMatchObject({ page: 2, totalItems: 13, totalPages: 2 });
    expect(view.items).toHaveLength(3);
  });

  it("1000건을 넘어도 range를 이어 끝까지 읽는다", async () => {
    const { client, queries } = createListStub(
      createNumberedRows(1200, (index) =>
        consultationRow({ id: `consultation-${String(index).padStart(4, "0")}` }),
      ) as ConsultationSupabaseRow[],
    );

    const view = await fetchConsultationList(client, { academyId: "academy-1" }, NOW);

    expect(view.totalItems).toBe(1200);
    expect(queries.flatMap((query) => query.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("조회 오류는 한국어 안내 뒤에 원인을 붙인 오류로 바꾼다", async () => {
    const { client } = createListStub([], new Error("permission denied"));

    await expect(fetchConsultationList(client, { academyId: "academy-1" }, NOW)).rejects.toThrow(
      "상담 목록을 불러오지 못했습니다: permission denied",
    );
  });
});

describe("createConsultationListQueryKey", () => {
  it("학원 범위와 검색·악기 필터·페이지를 queryKey에 묶는다", () => {
    const queryKey = createConsultationListQueryKey({
      academyId: "academy-1",
      search: "하늘",
      filters: { instrumentName: "첼로" },
      page: 2,
      pageSize: 20,
    });

    expect(queryKey).toEqual([
      "academy",
      "academy-1",
      "consultations",
      "list",
      "하늘",
      "첼로",
      "2",
      "20",
    ]);
  });
});

type MutationCall = {
  insert?: Record<string, unknown>;
  update?: Record<string, unknown>;
  deleted?: boolean;
  eq: Array<[string, string]>;
  select?: string;
};

function createMutationStub(result: {
  data: ConsultationSupabaseRow | Array<{ id: string }> | null;
  error: Error | null;
}) {
  const calls: MutationCall[] = [];
  const client = {
    from(table: string) {
      expect(table).toBe("consultations");
      const call: MutationCall = { eq: [] };
      calls.push(call);

      const selectBuilder = {
        select(select: string) {
          call.select = select;

          return Object.assign(Promise.resolve(result), { single: async () => result });
        },
      };
      const filter = {
        eq(column: string, value: string) {
          call.eq.push([column, value]);

          return call.eq.length < 2 ? filter : selectBuilder;
        },
      };

      return {
        insert(values: Record<string, unknown>) {
          call.insert = values;

          return selectBuilder;
        },
        update(values: Record<string, unknown>) {
          call.update = values;

          return filter;
        },
        delete() {
          call.deleted = true;

          return filter;
        },
      };
    },
  } as unknown as ConsultationMutationSupabaseClient;

  return { client, calls };
}

const profile = {
  name: "김하늘",
  age: 9,
  instrumentNames: ["피아노", "첼로"],
  phone: "010-1111-2222",
  school: "새봄초",
  memo: "화요일 선호",
};

describe("registerConsultation", () => {
  it("상담 내용을 학원 범위와 함께 저장하고, 빈 학교·특이사항·나이는 null로 보낸다", async () => {
    const { client, calls } = createMutationStub({ data: consultationRow(), error: null });

    await registerConsultation(client, { academyId: "academy-1", ...profile });
    await registerConsultation(client, {
      academyId: "academy-1",
      name: "박서준",
      instrumentNames: [],
      phone: "1234",
      school: "",
      memo: "",
    });

    expect(calls[0]).toMatchObject({
      select: CONSULTATION_SELECT,
      insert: {
        academy_id: "academy-1",
        name: "김하늘",
        age: 9,
        instrument_names: ["피아노", "첼로"],
        phone: "010-1111-2222",
        school: "새봄초",
        memo: "화요일 선호",
      },
    });
    expect(calls[1].insert).toEqual({
      academy_id: "academy-1",
      name: "박서준",
      age: null,
      instrument_names: [],
      phone: "1234",
      school: null,
      memo: null,
    });
  });

  it("저장된 row를 상담 목록 row로 돌려준다", async () => {
    const { client } = createMutationStub({ data: consultationRow(), error: null });

    await expect(registerConsultation(client, { academyId: "academy-1", ...profile })).resolves.toMatchObject({
      consultationId: "consultation-1",
      receivedAt: "2026-10-10T01:00:00+00:00",
    });
  });

  it("저장 오류와 빈 응답은 한국어 오류로 알린다", async () => {
    await expect(
      registerConsultation(createMutationStub({ data: null, error: new Error("permission denied") }).client, {
        academyId: "academy-1",
        ...profile,
      }),
    ).rejects.toThrow("상담을 등록하지 못했습니다: permission denied");
    await expect(
      registerConsultation(createMutationStub({ data: null, error: null }).client, {
        academyId: "academy-1",
        ...profile,
      }),
    ).rejects.toThrow("상담을 등록했지만 반환된 데이터가 없습니다.");
  });
});

describe("updateConsultation", () => {
  it("등록 폼의 모든 필드를 학원과 상담 id 범위 안에서 수정한다", async () => {
    const { client, calls } = createMutationStub({ data: consultationRow(), error: null });

    await updateConsultation(client, {
      academyId: "academy-1",
      consultationId: "consultation-1",
      ...profile,
      school: "",
    });

    expect(calls[0]).toEqual({
      update: {
        name: "김하늘",
        age: 9,
        instrument_names: ["피아노", "첼로"],
        phone: "010-1111-2222",
        school: null,
        memo: "화요일 선호",
      },
      eq: [
        ["academy_id", "academy-1"],
        ["id", "consultation-1"],
      ],
      select: CONSULTATION_SELECT,
    });
  });

  it("수정 오류는 한국어 오류로 알린다", async () => {
    await expect(
      updateConsultation(createMutationStub({ data: null, error: new Error("PGRST116") }).client, {
        academyId: "academy-1",
        consultationId: "consultation-1",
        ...profile,
      }),
    ).rejects.toThrow("상담을 수정하지 못했습니다: PGRST116");
  });
});

describe("deleteConsultation", () => {
  it("학원과 상담 id 범위 안에서 삭제한다", async () => {
    const { client, calls } = createMutationStub({ data: [{ id: "consultation-1" }], error: null });

    await deleteConsultation(client, { academyId: "academy-1", consultationId: "consultation-1" });

    expect(calls[0]).toEqual({
      deleted: true,
      eq: [
        ["academy_id", "academy-1"],
        ["id", "consultation-1"],
      ],
      select: "id",
    });
  });

  it("삭제된 행이 없으면(이미 삭제됐거나 권한이 없으면) 삭제 성공으로 착각하지 않고 오류로 알린다", async () => {
    await expect(
      deleteConsultation(createMutationStub({ data: [], error: null }).client, {
        academyId: "academy-1",
        consultationId: "consultation-1",
      }),
    ).rejects.toThrow("상담 기록을 삭제하지 못했습니다: 이미 삭제되었거나 삭제할 권한이 없습니다.");
  });

  it("삭제 오류는 한국어 오류로 알린다", async () => {
    await expect(
      deleteConsultation(createMutationStub({ data: null, error: new Error("permission denied") }).client, {
        academyId: "academy-1",
        consultationId: "consultation-1",
      }),
    ).rejects.toThrow("상담 기록을 삭제하지 못했습니다: permission denied");
  });
});
