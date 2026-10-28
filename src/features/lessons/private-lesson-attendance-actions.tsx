"use client";

import { Check, Pencil, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PrivateLesson } from "@/domain/private-lesson";
import type { MarkPrivateLesson } from "@/features/lessons/use-private-absence-reason-form";
import type { AssignedLessonTicketBalance } from "@/lib/api/lesson-tickets";
import { cn } from "@/lib/utils";

/** 선생님이 담당 악기의 잔여 회수와 만료일만 확인하도록 보여 준다(결제 정보는 없다). 배정된 회차권이 없으면 아무것도 그리지 않는다. */
export function AssignedTicketBalanceNote({
  lesson,
  balances,
  className,
  textColor,
}: {
  lesson: PrivateLesson;
  balances: AssignedLessonTicketBalance[];
  className?: string;
  textColor?: string;
}) {
  const balance = balances.find(
    (row) => row.studentId === lesson.studentId && row.instrumentId === lesson.instrumentId,
  );

  if (!balance) {
    return null;
  }

  return (
    <p className={cn("text-sm text-muted-foreground", className)} style={textColor ? { color: textColor } : undefined}>
      잔여 {balance.remainingCount}회 · 만료일 {balance.validUntil}
    </p>
  );
}

/** 개인레슨 한 건의 등원 확인·취소와 결석·사유 수정 버튼. 출석 확인 모달과 일별 테이블뷰가 함께 쓴다. */
export function PrivateLessonAttendanceActions({
  lesson,
  isPending,
  onMark,
  onCancelAttendance,
  onOpenReason,
}: {
  lesson: PrivateLesson;
  isPending: boolean;
  onMark: MarkPrivateLesson;
  onCancelAttendance: (lesson: PrivateLesson) => void;
  onOpenReason: (lessonId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {lesson.status === "present" ? (
        <Button
          type="button"
          variant="outline"
          aria-label={`${lesson.studentName} 개인레슨 등원 확인 취소`}
          disabled={isPending}
          onClick={() => onCancelAttendance(lesson)}
        >
          <RotateCcw aria-hidden="true" />
          등원 확인 취소
        </Button>
      ) : (
        <Button
          type="button"
          aria-label={`${lesson.studentName} 개인레슨 등원 확인`}
          disabled={isPending}
          onClick={() => onMark(lesson, "present")}
        >
          <Check aria-hidden="true" />
          등원 확인
        </Button>
      )}
      {lesson.status === "absent" ? (
        <Button
          type="button"
          variant="outline"
          aria-label={`${lesson.studentName} 개인레슨 결석 사유 수정`}
          disabled={isPending}
          onClick={() => onOpenReason(lesson.id)}
        >
          <Pencil aria-hidden="true" />
          사유 수정
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          aria-label={`${lesson.studentName} 개인레슨 결석`}
          disabled={isPending}
          onClick={() => onOpenReason(lesson.id)}
        >
          <X aria-hidden="true" />
          결석
        </Button>
      )}
    </div>
  );
}
