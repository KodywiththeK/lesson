import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { MemoChecklistAddButton, MemoChecklistItems, MemoContent } from "./memo-checklist";

describe("MemoContent", () => {
  it("체크 줄은 체크박스로, 나머지 줄은 그대로 글자로 보여 준다", () => {
    render(<MemoContent content={"학부모 전화 옴\n- [ ] 교재 주문\n- [x] 보강 안내"} onContentChange={vi.fn()} />);

    expect(screen.getByText("학부모 전화 옴")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "교재 주문" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "보강 안내" })).toBeChecked();
  });

  it("체크박스를 누르면 그 줄만 바꾼 본문을 돌려준다", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();
    render(<MemoContent content={"학부모 전화 옴\n- [ ] 교재 주문\n- [x] 보강 안내"} onContentChange={onContentChange} />);

    await user.click(screen.getByRole("checkbox", { name: "교재 주문" }));

    expect(onContentChange).toHaveBeenCalledWith("학부모 전화 옴\n- [x] 교재 주문\n- [x] 보강 안내");
  });

  it("disabled이면 체크박스를 누를 수 없다", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();
    render(<MemoContent content="- [ ] 교재 주문" onContentChange={onContentChange} disabled />);

    await user.click(screen.getByRole("checkbox", { name: "교재 주문" }));

    expect(onContentChange).not.toHaveBeenCalled();
  });
});

describe("MemoChecklistItems", () => {
  it("체크 항목만 모아 보여 주고 토글하면 본문을 돌려준다", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();
    render(<MemoChecklistItems content={"일반 메모\n- [ ] 교재 주문"} onContentChange={onContentChange} />);

    expect(screen.queryByText("일반 메모")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "교재 주문" }));

    expect(onContentChange).toHaveBeenCalledWith("일반 메모\n- [x] 교재 주문");
  });

  it("내용이 빈 체크 줄도 이름 있는 체크박스로 보여 준다", () => {
    render(<MemoChecklistItems content={"- [ ] "} onContentChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "빈 체크 항목" })).toBeInTheDocument();
  });

  it("체크 항목이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<MemoChecklistItems content="일반 메모" onContentChange={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("MemoChecklistAddButton", () => {
  function Harness({ content, onContentChange }: { content: string; onContentChange: (next: string) => void }) {
    const ref = useRef<HTMLTextAreaElement>(null);

    return (
      <>
        <textarea aria-label="본문" ref={ref} defaultValue={content} />
        <MemoChecklistAddButton content={content} onContentChange={onContentChange} textareaRef={ref} />
      </>
    );
  }

  it("누르면 빈 체크 줄을 붙인 본문을 돌려준다", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();
    render(<Harness content="학부모 전화 옴" onContentChange={onContentChange} />);

    await user.click(screen.getByRole("button", { name: "체크 항목 추가" }));

    expect(onContentChange).toHaveBeenCalledWith("학부모 전화 옴\n- [ ] ");
  });
});
