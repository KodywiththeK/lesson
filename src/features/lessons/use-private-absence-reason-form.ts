import { useState } from "react";

import type { PrivateLesson } from "@/domain/private-lesson";

/** reason은 결석일 때만 의미가 있다. 결석 사유 수정도 absent로 다시 알린다. 저장에 실패하면(false) 폼을 닫지 않는다. */
export type MarkPrivateLesson = (
  lesson: PrivateLesson,
  status: "present" | "absent",
  reason?: string,
) => void | boolean | Promise<boolean | void>;

/**
 * 개인레슨 결석 사유 입력 폼의 열림 상태. 출석 확인 모달과 일별 테이블뷰가 함께 쓴다.
 * 사유 폼은 연 날짜에서만 유효해서 날짜가 바뀌면 열려 있던 폼은 남지 않는다.
 */
export function usePrivateAbsenceReasonForm({
  date,
  onMark,
}: {
  date: string;
  onMark: MarkPrivateLesson;
}) {
  const [form, setForm] = useState<{ date: string; lessonId: string } | null>(null);
  // 날짜가 바뀌면 열려 있던 폼을 버린다. 다른 날짜로 갔다 돌아와도 다시 나타나지 않는다.
  if (form && form.date !== date) {
    setForm(null);
  }
  const reasonLessonId = form?.lessonId ?? null;
  const close = () => setForm(null);

  return {
    reasonLessonId,
    open: (lessonId: string) => setForm({ date, lessonId }),
    close,
    // 저장이 실패하면(false) 입력한 사유를 잃지 않도록 폼을 열어 둔다.
    submit: async (lesson: PrivateLesson, reason: string | undefined) => {
      if ((await onMark(lesson, "absent", reason)) !== false) {
        close();
      }
    },
  };
}
