import { describe, expect, it, vi } from "vitest";

import { deletePrivateLessonEvent, updatePrivateLessonEvent } from "./private-lessons";

describe("개인레슨 일정 변경 API", () => {
  it("수정할 날짜·시간·선생님과 선택 사유를 RPC로 보낸다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { event_id: "event-1" }, error: null });
    await updatePrivateLessonEvent({ rpc }, {
      academyId: "academy-1", eventId: "event-1", teacherId: "teacher-2",
      startAt: "2026-10-20T14:00:00+09:00", endAt: "2026-10-20T14:40:00+09:00", reason: "시간 변경",
    });
    expect(rpc).toHaveBeenCalledWith("update_private_lesson_event", {
      p_academy_id: "academy-1", p_event_id: "event-1", p_teacher_id: "teacher-2",
      p_starts_at: "2026-10-20T14:00:00+09:00", p_ends_at: "2026-10-20T14:40:00+09:00",
      p_reason: "시간 변경",
    });
  });

  it("삭제는 사유 없이 RPC로 보내고 실패를 호출자에게 전달한다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("출결을 먼저 취소") });
    await expect(deletePrivateLessonEvent({ rpc }, "academy-1", "event-1"))
      .rejects.toThrow("출결을 먼저 취소");
    expect(rpc).toHaveBeenCalledWith("delete_private_lesson_event", {
      p_academy_id: "academy-1", p_event_id: "event-1",
    });
  });
});
