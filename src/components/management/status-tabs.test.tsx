import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/tabs";
import { StatusTabs } from "./status-tabs";

describe("상태 탭", () => {
  it("전달한 상태를 균등 탭으로 보여주고 선택을 알린다", async () => {
    const onChange = vi.fn();
    render(<Tabs value="active" onValueChange={onChange}>
      <StatusTabs label="상태" options={[
        { value: "active", label: "사용중", dotClassName: "bg-emerald-500" },
        { value: "completed", label: "사용완료", dotClassName: "bg-blue-500" },
      ]} />
    </Tabs>);
    expect(screen.getByRole("tablist", { name: "상태" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "사용중" })).toHaveAttribute("aria-selected", "true");
    await userEvent.setup().click(screen.getByRole("tab", { name: "사용완료" }));
    expect(onChange).toHaveBeenCalledWith("completed");
  });
  it("항목이 많아도 좁은 화면에서 가로 스크롤로 확인한다", () => {
    render(<Tabs value="one"><StatusTabs label="여러 상태" options={[
      { value: "one", label: "첫 번째 상태", dotClassName: "bg-blue-500" },
      { value: "two", label: "두 번째 상태", dotClassName: "bg-blue-500" },
      { value: "three", label: "세 번째 상태", dotClassName: "bg-blue-500" },
      { value: "four", label: "네 번째 상태", dotClassName: "bg-blue-500" },
    ]} /></Tabs>);
    const tabs = screen.getByRole("tablist", { name: "여러 상태" });
    expect(tabs.parentElement).toHaveClass("overflow-x-auto");
    expect(screen.getByRole("tab", { name: "네 번째 상태" })).toBeInTheDocument();
  });
});
