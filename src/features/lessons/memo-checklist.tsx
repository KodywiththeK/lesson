"use client";

import { ListChecks } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  appendMemoChecklistLine,
  parseMemoChecklist,
  toggleMemoChecklistLine,
  type MemoChecklistItem,
} from "@/domain/memo-checklist";

type ChecklistProps = {
  content: string;
  /** 체크를 바꾼 본문. 저장은 쓰는 쪽이 한다(월별·일별 모두 누르면 바로 저장). */
  onContentChange: (content: string) => void;
  disabled?: boolean;
};

function ChecklistRow({ item, disabled, onToggle }: { item: MemoChecklistItem; disabled?: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox
        className="mt-0.5"
        checked={item.checked}
        disabled={disabled}
        aria-label={item.text ? undefined : "빈 체크 항목"}
        onCheckedChange={onToggle}
      />
      <span className={item.checked ? "text-muted-foreground line-through" : undefined}>{item.text}</span>
    </label>
  );
}

/** 저장된 메모 본문. `- [ ]` 줄은 체크박스로, 나머지 줄은 글자로 보여 준다. */
export function MemoContent({ content, onContentChange, disabled }: ChecklistProps) {
  const itemsByLine = new Map(parseMemoChecklist(content).map((item) => [item.lineIndex, item]));

  return (
    <div className="grid gap-1">
      {content.split("\n").map((line, lineIndex) => {
        const item = itemsByLine.get(lineIndex);

        return item ? (
          <ChecklistRow
            key={lineIndex}
            item={item}
            disabled={disabled}
            onToggle={() => onContentChange(toggleMemoChecklistLine(content, lineIndex))}
          />
        ) : (
          <p key={lineIndex} className="whitespace-pre-wrap text-sm">
            {line === "" ? " " : line}
          </p>
        );
      })}
    </div>
  );
}

/** 작성 중인 본문에서 체크 항목만 모아 보여 준다. 항목이 없으면 그리지 않는다. */
export function MemoChecklistItems({ content, onContentChange, disabled }: ChecklistProps) {
  const items = parseMemoChecklist(content);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-1" role="group" aria-label="체크 항목">
      {items.map((item) => (
        <ChecklistRow
          key={item.lineIndex}
          item={item}
          disabled={disabled}
          onToggle={() => onContentChange(toggleMemoChecklistLine(content, item.lineIndex))}
        />
      ))}
    </div>
  );
}

/** 본문 끝에 빈 체크 줄을 붙이고 바로 이어 쓸 수 있게 입력 칸 끝에 커서를 둔다. */
export function MemoChecklistAddButton({
  content,
  onContentChange,
  textareaRef,
}: {
  content: string;
  onContentChange: (content: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        const next = appendMemoChecklistLine(content);
        onContentChange(next);
        // 본문이 갱신된 뒤에 커서를 끝으로 옮긴다.
        setTimeout(() => {
          const textarea = textareaRef.current;
          textarea?.focus();
          textarea?.setSelectionRange(next.length, next.length);
        }, 0);
      }}
    >
      <ListChecks aria-hidden="true" />
      체크 항목 추가
    </Button>
  );
}
