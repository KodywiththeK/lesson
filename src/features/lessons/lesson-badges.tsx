"use client";

import { Badge } from "@/components/ui/badge";
import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";

export function AttendanceBadge({
  status,
}: {
  status: DailyAcademyAttendanceRow["status"];
}) {
  if (status === "present") {
    return <Badge>출석</Badge>;
  }

  if (status === "absent") {
    return <Badge variant="destructive">결석</Badge>;
  }

  return <Badge variant="secondary">대기</Badge>;
}

export function OriginBadge({ label }: { label: string | undefined }) {
  if (!label) {
    return null;
  }

  return <Badge variant="outline">{label}</Badge>;
}
