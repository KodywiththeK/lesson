"use client";

import { Badge } from "@/components/ui/badge";
import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import type { PrivateLessonStatus } from "@/domain/private-lesson";

export function AttendanceBadge({
  status,
}: {
  status: DailyAcademyAttendanceRow["status"];
}) {
  if (status === "present") {
    return <Badge variant="success" className="border-success">출석</Badge>;
  }

  if (status === "absent") {
    return <Badge variant="destructive" className="border-destructive">결석</Badge>;
  }

  return <Badge variant="secondary" className="border-border">대기</Badge>;
}

export function PrivateLessonStatusBadge({ status, label }: {
  status: PrivateLessonStatus;
  label: string;
}) {
  if (status === "present") return <Badge variant="success" className="border-success">{label}</Badge>;
  if (status === "absent") return <Badge variant="destructive" className="border-destructive">{label}</Badge>;
  if (status === "scheduled") return <Badge variant="secondary" className="border-border">{label}</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}

export function OriginBadge({ label }: { label: string | undefined }) {
  if (!label) {
    return null;
  }

  return <Badge variant="outline">{label}</Badge>;
}
