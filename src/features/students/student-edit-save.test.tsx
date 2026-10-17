import { describe, expect, it } from "vitest";

import { toStudentSaveFailureMessage } from "./student-edit-save";

describe("toStudentSaveFailureMessage", () => {
  it("원생 정보는 한 번에 저장되므로 아무것도 저장되지 않았다고 알리고 원인을 덧붙인다", () => {
    expect(
      toStudentSaveFailureMessage(
        new Error("원생 정보를 수정하지 못했습니다: 같은 악기와 수업 형태를 이미 수강 중입니다."),
      ),
    ).toBe("저장되지 않았습니다. 같은 악기와 수업 형태를 이미 수강 중입니다.");
  });

  it("영문 원인은 사용자 문구로 바꿔 알린다", () => {
    const message = toStudentSaveFailureMessage(new Error("permission denied for table students"));

    expect(message).toBe("저장되지 않았습니다. 이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.");
    expect(message).not.toMatch(/permission denied/);
  });
});
