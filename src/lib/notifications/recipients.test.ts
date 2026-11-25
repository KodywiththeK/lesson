import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { fetchNotificationRecipients } from "./recipients";

describe("fetchNotificationRecipients", () => {
  it("구성원 행을 역할·선생님·이메일·알림 설정으로 바꾼다", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          user_id: "user-1",
          role: "teacher",
          teacher_id: "teacher-1",
          email: "t@example.com",
          morning_email: true,
          push_lesson_change: false,
          push_consultation: true,
          push_join_request: true,
          push_morning_brief: true,
        },
      ],
      error: null,
    }));

    await expect(fetchNotificationRecipients({ rpc } as unknown as SupabaseClient, "academy-1")).resolves.toEqual([
      {
        userId: "user-1",
        role: "teacher",
        teacherId: "teacher-1",
        email: "t@example.com",
        preferences: {
          morningEmail: true,
          pushLessonChange: false,
          pushConsultation: true,
          pushJoinRequest: true,
          pushMorningBrief: true,
        },
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("list_notification_recipients", { p_academy_id: "academy-1" });
  });
});
