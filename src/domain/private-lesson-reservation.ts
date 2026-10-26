export type PrivateLessonTicketWindow = {
  remainingCount: number;
  validFrom: string;
  validUntil: string;
};

/** 예약은 예정 일정만 차지한다. 실제 잔여는 등원 확인 때만 바뀐다. */
export function getPrivateLessonAvailability(
  ticket: PrivateLessonTicketWindow | undefined,
  reservedCount: number,
  lessonDate: string,
) {
  const remainingCount = ticket?.remainingCount ?? 0;
  const isValidOnDate = Boolean(
    ticket && ticket.validFrom <= lessonDate && lessonDate <= ticket.validUntil,
  );

  return {
    remainingCount,
    reservedCount,
    availableCount: isValidOnDate ? Math.max(0, remainingCount - reservedCount) : 0,
    isValidOnDate,
  };
}
