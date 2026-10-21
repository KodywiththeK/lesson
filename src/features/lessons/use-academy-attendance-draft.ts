import { useState } from "react";

import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import {
  isAttendanceEditable,
  type AttendanceChoice,
  type AttendanceDraft,
} from "@/features/lessons/academy-attendance-checklist";
import type { AttendanceSelection } from "@/features/lessons/workspace-types";

type DateDraft = { date: string; choices: AttendanceDraft };

const NO_CHOICES: AttendanceDraft = {};

/**
 * 학원레슨 출석을 확인 전에 임시로 고르는 상태. 출석 확인 모달과 일별 테이블뷰가 함께 쓴다.
 * 고른 내용은 확인해야 저장되고, 날짜가 바뀌거나 버리면 사라진다(일정 이동으로 다른 날을 보게 될 때 포함).
 */
export function useAcademyAttendanceDraft({
  date,
  rows,
  onConfirmAttendance,
}: {
  date: string;
  rows: DailyAcademyAttendanceRow[];
  /** 고른 출결을 한꺼번에 저장한다. 저장에 성공하면 true. */
  onConfirmAttendance: (selections: AttendanceSelection[]) => Promise<boolean>;
}) {
  const [dateDraft, setDateDraft] = useState<DateDraft>({ date, choices: {} });
  const choices = dateDraft.date === date ? dateDraft.choices : NO_CHOICES;
  const selections = rows.flatMap((row) => {
    const status = choices[row.lessonEventId];

    return status && status !== row.status && isAttendanceEditable(row) ? [{ row, status }] : [];
  });

  const updateChoices = (update: (current: AttendanceDraft) => AttendanceDraft) =>
    setDateDraft({ date, choices: update(choices) });
  const discard = () => setDateDraft({ date, choices: {} });

  return {
    choices,
    selections,
    choose: (row: DailyAcademyAttendanceRow, choice: AttendanceChoice | null) =>
      updateChoices((current) => withChoice(current, [row], choice)),
    chooseMany: (targetRows: DailyAcademyAttendanceRow[], choice: AttendanceChoice) =>
      updateChoices((current) => withChoice(current, targetRows, choice)),
    discard,
    /** 저장에 성공하면 고른 내용을 비우고 true를 돌려준다. 실패하면 남겨 다시 시도하게 한다. */
    confirm: async () => {
      const isSaved = await onConfirmAttendance(selections);

      if (isSaved) {
        discard();
      }

      return isSaved;
    },
  };
}

/** choice가 null이면 그 원생의 임시 선택을 지워 저장된 상태로 되돌린다. */
function withChoice(
  current: AttendanceDraft,
  rows: DailyAcademyAttendanceRow[],
  choice: AttendanceChoice | null,
): AttendanceDraft {
  const next = { ...current };

  for (const row of rows) {
    if (choice) {
      next[row.lessonEventId] = choice;
    } else {
      delete next[row.lessonEventId];
    }
  }

  return next;
}
