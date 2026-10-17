import { useCallback, useState } from "react";

import type { ListView } from "@/domain/common-list";
import type { StudentListRow } from "@/domain/student-list";

type StudentListData = ListView<StudentListRow> | undefined;

/** 저장 결과로 만든 행과, 그 행을 만든 시점의 목록 쿼리 data. */
type StudentRowOverride = { row: StudentListRow; baseData: StudentListData };

/**
 * 수정·상태 변경 직후 목록이 서버 재조회를 기다리지 않고 바뀐 모습을 보이게 하는 임시 행.
 * override는 만든 시점의 목록 data(`baseData`)와 같은 참조인 동안만 쓴다. TanStack Query는 재조회 결과가
 * 깊게 같으면 같은 참조를 유지하므로 override가 남고, 서버 값이 달라지면 새 참조가 되어 서버 값이 우선한다.
 */
export function useStudentRowOverrides(listData: StudentListData) {
  const [overrides, setOverrides] = useState<Record<string, StudentRowOverride>>({});

  const apply = useCallback(
    (row: StudentListRow) => {
      setOverrides((current) => ({ ...current, [row.studentId]: { row, baseData: listData } }));
    },
    [listData],
  );

  function resolve(rows: StudentListRow[]): StudentListRow[];
  function resolve(row: StudentListRow): StudentListRow;
  function resolve(rowOrRows: StudentListRow | StudentListRow[]) {
    const resolveRow = (row: StudentListRow) => {
      const override = overrides[row.studentId];

      return override && override.baseData === listData ? override.row : row;
    };

    return Array.isArray(rowOrRows) ? rowOrRows.map(resolveRow) : resolveRow(rowOrRows);
  }

  return { apply, resolve };
}
