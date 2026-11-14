/**
 * 메모 본문의 체크 줄. 메모는 평문 한 칸이라 `- [ ] 할 일` / `- [x] 한 일` 줄을 체크 항목으로 읽는다.
 * 저장 형식이 평문 그대로라 DB 변경이 필요 없고, 사유서 자동 기록 같은 일반 줄과 섞여도 된다.
 */
export type MemoChecklistItem = {
  /** 본문을 `\n`으로 나눴을 때의 줄 번호(0부터) */
  lineIndex: number;
  checked: boolean;
  text: string;
};

const CHECKLIST_LINE = /^(\s*[-*] \[)([ xX])(\]) ?(.*)$/;
const EMPTY_CHECKLIST_LINE = "- [ ] ";

export function parseMemoChecklist(content: string): MemoChecklistItem[] {
  return content.split("\n").flatMap((line, lineIndex) => {
    const match = CHECKLIST_LINE.exec(line);

    return match ? [{ lineIndex, checked: match[2] !== " ", text: match[4] }] : [];
  });
}

/** 지정한 줄이 체크 줄일 때만 체크 상태를 뒤집는다. 다른 줄과 줄바꿈은 그대로 둔다. */
export function toggleMemoChecklistLine(content: string, lineIndex: number): string {
  const lines = content.split("\n");
  const match = CHECKLIST_LINE.exec(lines[lineIndex] ?? "");

  if (!match) {
    return content;
  }

  const mark = match[2] === " " ? "x" : " ";
  lines[lineIndex] = `${match[1]}${mark}${match[3]}${match[4] === "" ? "" : ` ${match[4]}`}`;

  return lines.join("\n");
}

/** 메모 끝에 빈 체크 줄을 붙인다. 내용이 비어 있으면 체크 줄만 남긴다. */
export function appendMemoChecklistLine(content: string): string {
  return content.trim() === "" ? EMPTY_CHECKLIST_LINE : `${content}\n${EMPTY_CHECKLIST_LINE}`;
}
