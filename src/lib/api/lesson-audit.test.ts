import { describe, expect, it, vi } from "vitest";

import { fetchLessonAuditHistory } from "./lesson-audit";

describe("레슨 변경 이력 API", () => {
  it("학원·날짜·레슨 종류만 전달하고 허용된 표시 필드만 변환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: "audit-1",
        occurred_at: "2026-10-16T15:02:00Z",
        event_type: "absence.resolved",
        student_name: "김민지",
        reason: "개인 사정",
        resolution: "pass",
        metadata: { unrelated_secret: "노출 금지" },
      }],
      error: null,
    });

    const result = await fetchLessonAuditHistory({ rpc }, {
      academyId: "academy-1",
      date: "2026-10-16",
      lessonKind: "academy",
    });

    expect(rpc).toHaveBeenCalledWith("list_lesson_change_history", {
      p_academy_id: "academy-1",
      p_lesson_date: "2026-10-16",
      p_lesson_kind: "academy",
    });
    expect(result).toEqual([{
      id: "audit-1",
      occurredAt: "2026-10-16T15:02:00Z",
      label: "패스 확정",
      studentName: "김민지",
      reason: "개인 사정",
    }]);
  });

  it("조회 오류는 원문을 그대로 화면으로 전달하지 않는다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("permission denied for table audit_events") });

    await expect(fetchLessonAuditHistory({ rpc }, {
      academyId: "academy-1",
      date: "2026-10-16",
      lessonKind: "private",
    })).rejects.toThrow("변경 이력을 불러오지 못했습니다");
  });
});
