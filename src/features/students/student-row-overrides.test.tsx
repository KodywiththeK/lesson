import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildStudentList, type StudentListRow } from "@/domain/student-list";

import { useStudentRowOverrides } from "./student-row-overrides";

function row(studentId: string, name: string): StudentListRow {
  return {
    academyId: "academy-1",
    studentId,
    name,
    teacherNames: [],
    instrumentNames: [],
    weekdayLabels: [],
  };
}

function listOf(...rows: StudentListRow[]) {
  return buildStudentList(rows, { academyId: "academy-1" });
}

describe("useStudentRowOverrides", () => {
  it("저장 결과를 만든 시점의 목록 data가 그대로인 동안 같은 id의 행에 적용한다", () => {
    const data = listOf(row("student-1", "김민지"), row("student-2", "이서윤"));
    const { result } = renderHook(() => useStudentRowOverrides(data));

    act(() => result.current.apply(row("student-1", "김민지(수정)")));

    expect(result.current.resolve(data.items).map((item) => item.name)).toEqual([
      "김민지(수정)",
      "이서윤",
    ]);
    expect(result.current.resolve(row("student-1", "낡은 스냅샷")).name).toBe("김민지(수정)");
    expect(result.current.resolve(row("student-3", "박하준")).name).toBe("박하준");
  });

  it("목록 data가 다른 참조가 되면(서버 값이 달라지면) override를 버리고 서버 값을 쓴다", () => {
    const data = listOf(row("student-1", "김민지"));
    const { result, rerender } = renderHook(({ listData }) => useStudentRowOverrides(listData), {
      initialProps: { listData: data },
    });

    act(() => result.current.apply(row("student-1", "김민지(수정)")));

    const serverData = listOf(row("student-1", "김민지(다른 사용자 수정)"));
    rerender({ listData: serverData });

    expect(result.current.resolve(serverData.items)[0].name).toBe("김민지(다른 사용자 수정)");
  });

  it("목록 data가 같은 참조로 다시 오면(재조회 결과가 같으면) override를 유지한다", () => {
    const data = listOf(row("student-1", "김민지"));
    const { result, rerender } = renderHook(({ listData }) => useStudentRowOverrides(listData), {
      initialProps: { listData: data },
    });

    act(() => result.current.apply(row("student-1", "김민지(수정)")));
    rerender({ listData: data });

    expect(result.current.resolve(data.items)[0].name).toBe("김민지(수정)");
  });

  it("목록에 없는 id의 override는 어떤 행도 바꾸지 않는다", () => {
    const data = listOf(row("student-1", "김민지"));
    const { result } = renderHook(() => useStudentRowOverrides(data));

    act(() => result.current.apply(row("student-9", "없는 원생")));

    expect(result.current.resolve(data.items).map((item) => item.name)).toEqual(["김민지"]);
  });

  it("같은 원생을 다시 저장하면 나중 결과가 이긴다", () => {
    const data = listOf(row("student-1", "김민지"));
    const { result } = renderHook(() => useStudentRowOverrides(data));

    act(() => result.current.apply(row("student-1", "첫 번째")));
    act(() => result.current.apply(row("student-1", "두 번째")));

    expect(result.current.resolve(data.items)[0].name).toBe("두 번째");
  });
});
