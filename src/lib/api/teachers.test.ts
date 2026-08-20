import { describe, expect, it } from "vitest";

import {
  createTeacherListQueryOptions,
  fetchTeacherList,
  type TeacherListSupabaseClient,
  type TeacherSupabaseRow,
} from "./teachers";

function createSupabaseStub(
  rows: TeacherSupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
    [];
  const client: TeacherListSupabaseClient = {
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

describe("fetchTeacherList", () => {
  it("Supabase 선생님 row를 도메인 목록으로 변환하고 academy_id로 제한한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "teacher-1",
        academy_id: "academy-1",
        name: "박선생",
        part: "피아노",
        phone: "010-1111-1111",
        registered_on: "2026-08-01",
        salary_type: "ratio",
      },
    ]);

    const result = await fetchTeacherList(client, {
      academyId: "academy-1",
      search: "비율제",
    });

    expect(calls).toEqual([
      {
        table: "teachers",
        select: "id, academy_id, name, part, phone, registered_on, salary_type",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(calls[0].select).not.toContain("resident_registration");
    expect(result.items[0]).toMatchObject({
      academyId: "academy-1",
      teacherId: "teacher-1",
      name: "박선생",
      part: "피아노",
      contact: "010-1111-1111",
      registeredAt: "2026-08-01",
      payType: "ratio",
    });
  });

  it("Supabase 오류는 사용자에게 전달 가능한 오류로 변환한다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(
      fetchTeacherList(client, {
        academyId: "academy-1",
      }),
    ).rejects.toThrow("선생님 목록을 불러오지 못했습니다: permission denied");
  });
});

describe("createTeacherListQueryOptions", () => {
  it("학원 범위와 검색/필터를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createTeacherListQueryOptions(client, {
      academyId: "academy-1",
      search: "박",
      filters: {
        part: "피아노",
        payType: "ratio",
      },
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "teachers",
      "list",
      "박",
      "피아노",
      "ratio",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });
});
