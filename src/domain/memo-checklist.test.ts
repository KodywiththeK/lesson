import { describe, expect, it } from "vitest";

import {
  appendMemoChecklistLine,
  parseMemoChecklist,
  toggleMemoChecklistLine,
} from "./memo-checklist";

describe("parseMemoChecklist", () => {
  it("`- [ ]`, `- [x]` 줄만 체크 항목으로 읽고 줄 번호를 함께 돌려준다", () => {
    const content = ["학부모 전화 옴", "- [ ] 교재 주문", "- [x] 보강 안내", "- 그냥 목록", "[ ] 대괄호만"].join("\n");

    expect(parseMemoChecklist(content)).toEqual([
      { lineIndex: 1, checked: false, text: "교재 주문" },
      { lineIndex: 2, checked: true, text: "보강 안내" },
    ]);
  });

  it("대문자 X와 별표 접두사, 들여쓰기도 체크 항목으로 읽는다", () => {
    expect(parseMemoChecklist("* [X] 대문자\n  - [ ] 들여쓰기")).toEqual([
      { lineIndex: 0, checked: true, text: "대문자" },
      { lineIndex: 1, checked: false, text: "들여쓰기" },
    ]);
  });

  it("체크 줄이 없거나 내용이 비어 있으면 빈 목록이다", () => {
    expect(parseMemoChecklist("")).toEqual([]);
    expect(parseMemoChecklist("체크 없는 메모")).toEqual([]);
  });

  it("텍스트가 비어 있어도 `- [ ]`만 있는 줄은 항목이다", () => {
    expect(parseMemoChecklist("- [ ]")).toEqual([{ lineIndex: 0, checked: false, text: "" }]);
  });
});

describe("toggleMemoChecklistLine", () => {
  it("지정한 줄의 체크만 바꾸고 나머지 줄과 줄바꿈은 그대로 둔다", () => {
    const content = "학부모 전화 옴\n- [ ] 교재 주문\n- [x] 보강 안내\n마지막 줄";

    expect(toggleMemoChecklistLine(content, 1)).toBe("학부모 전화 옴\n- [x] 교재 주문\n- [x] 보강 안내\n마지막 줄");
    expect(toggleMemoChecklistLine(content, 2)).toBe("학부모 전화 옴\n- [ ] 교재 주문\n- [ ] 보강 안내\n마지막 줄");
  });

  it("들여쓰기와 접두사 문자를 유지한다", () => {
    expect(toggleMemoChecklistLine("  * [ ] 할 일", 0)).toBe("  * [x] 할 일");
  });

  it("체크 줄이 아닌 줄 번호나 범위를 벗어난 번호는 내용을 바꾸지 않는다", () => {
    const content = "일반 줄\n- [ ] 할 일";

    expect(toggleMemoChecklistLine(content, 0)).toBe(content);
    expect(toggleMemoChecklistLine(content, 5)).toBe(content);
  });
});

describe("appendMemoChecklistLine", () => {
  it("빈 메모에는 체크 줄만, 내용이 있으면 새 줄로 이어 붙인다", () => {
    expect(appendMemoChecklistLine("")).toBe("- [ ] ");
    expect(appendMemoChecklistLine("  \n")).toBe("- [ ] ");
    expect(appendMemoChecklistLine("학부모 전화 옴")).toBe("학부모 전화 옴\n- [ ] ");
  });
});
