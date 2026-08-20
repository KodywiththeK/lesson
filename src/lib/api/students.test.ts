import { describe, expect, it } from "vitest";

import {
  createStudentListQueryOptions,
  fetchStudentList,
  type StudentSupabaseRow,
  type StudentListSupabaseClient,
} from "./students";

function createSupabaseStub(
  rows: StudentSupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
    [];
  const client: StudentListSupabaseClient = {
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

describe("fetchStudentList", () => {
  it("Supabase 원생 row를 도메인 원생 목록으로 변환한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "student-1",
        academy_id: "academy-1",
        name: "김민지",
        student_instruments: [
          {
            instrument_name: "피아노",
            weekdays: ["월", "수"],
            teachers: {
              name: "박선생",
            },
          },
        ],
      },
      {
        id: "student-2",
        academy_id: "academy-1",
        name: "이서윤",
        student_instruments: [
          {
            instrument_name: "바이올린",
            weekdays: ["화"],
            teachers: {
              name: "최선생",
            },
          },
        ],
      },
    ]);

    const result = await fetchStudentList(client, {
      academyId: "academy-1",
      search: "피아노",
    });

    expect(calls).toEqual([
      {
        table: "students",
        select:
          "id, academy_id, name, student_instruments(instrument_name, weekdays, teachers(name))",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result.items.map((student) => student.name)).toEqual(["김민지"]);
    expect(result.items[0]).toMatchObject({
      academyId: "academy-1",
      studentId: "student-1",
      teacherNames: ["박선생"],
      instrumentNames: ["피아노"],
      weekdayLabels: ["월", "수"],
    });
  });

  it("Supabase 오류는 사용자에게 전달 가능한 오류로 변환한다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(
      fetchStudentList(client, {
        academyId: "academy-1",
      }),
    ).rejects.toThrow("원생 목록을 불러오지 못했습니다: permission denied");
  });
});

describe("createStudentListQueryOptions", () => {
  it("학원 범위와 검색/필터를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createStudentListQueryOptions(client, {
      academyId: "academy-1",
      search: "민",
      filters: {
        teacherName: "박선생",
        instrumentName: "피아노",
        weekdayLabel: "월",
      },
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "students",
      "list",
      "all",
      "민",
      "박선생",
      "피아노",
      "월",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });
});
