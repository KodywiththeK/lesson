import { describe, expect, it, vi } from "vitest";
import { saveTeacherMessageTemplate } from "./teacher-message-templates";

describe("선생님 문자 템플릿 API", () => {
  it("학원 범위와 템플릿 내용을 서버에 전달한다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "t", title: "기본", content: "{선생님}", active: true }, error: null });
    const result = await saveTeacherMessageTemplate({ rpc }, { academyId: "a", title: "기본", content: "{선생님}" });
    expect(rpc).toHaveBeenCalledWith("save_teacher_message_template", { p_academy_id: "a", p_id: null, p_title: "기본", p_content: "{선생님}" });
    expect(result).toMatchObject({ id: "t", title: "기본" });
  });
});
