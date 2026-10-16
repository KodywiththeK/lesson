import { describe, expect, it } from "vitest";

import {
  createTeacherStudentRosterQueryOptions,
  fetchTeacherStudentRoster,
  type TeacherStudentRosterSupabaseClient,
} from "./teacher-student-roster";

function createClient(data: unknown, error: Error | null = null) {
  const calls: Array<{ functionName: string; payload: Record<string, unknown> }> = [];
  const client: TeacherStudentRosterSupabaseClient = {
    async rpc(functionName, payload) {
      calls.push({ functionName, payload });

      return { data: error ? null : (data as never), error };
    },
  };

  return { client, calls };
}

const rpcRows = [
  { student_id: "s-2", student_name: "이서윤", instrument_names: ["바이올린"], weekdays: ["화"] },
  { student_id: "s-1", student_name: "김민지", instrument_names: ["피아노"], weekdays: ["월", "수"] },
];

describe("fetchTeacherStudentRoster", () => {
  it("선생님 전용 조회 RPC로 담당 원생의 이름, 악기, 요일만 가져온다", async () => {
    const { client, calls } = createClient(rpcRows);

    const view = await fetchTeacherStudentRoster(client, { academyId: "academy-1" });

    expect(calls).toEqual([
      { functionName: "list_students_for_teacher", payload: { p_academy_id: "academy-1" } },
    ]);
    expect(view.items).toEqual([
      {
        academyId: "academy-1",
        studentId: "s-1",
        name: "김민지",
        instrumentNames: ["피아노"],
        weekdayLabels: ["월", "수"],
      },
      {
        academyId: "academy-1",
        studentId: "s-2",
        name: "이서윤",
        instrumentNames: ["바이올린"],
        weekdayLabels: ["화"],
      },
    ]);
  });

  it("결과가 비어 있어도 빈 목록을 돌려준다", async () => {
    const { client } = createClient(null);

    await expect(fetchTeacherStudentRoster(client, { academyId: "academy-1" })).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });

  it("조회 오류는 사용자에게 보여 줄 수 있는 문구로 바꾼다", async () => {
    const { client } = createClient(null, new Error("선생님 계정으로만 담당 원생 명단을 볼 수 있습니다."));

    await expect(fetchTeacherStudentRoster(client, { academyId: "academy-1" })).rejects.toThrow(
      "담당 원생 명단을 불러오지 못했습니다: 선생님 계정으로만 담당 원생 명단을 볼 수 있습니다.",
    );
  });

  it("학원, 검색어, 페이지를 쿼리 키에 묶는다", async () => {
    const { client } = createClient(rpcRows);
    const options = createTeacherStudentRosterQueryOptions(client, {
      academyId: "academy-1",
      search: "피아노",
      page: 2,
      pageSize: 20,
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "students",
      "teacher-roster",
      "피아노",
      "2",
      "20",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({ totalItems: 1 });
  });
});
