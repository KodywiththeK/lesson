import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("빈 목록이나 불러오는 중 같은 안내 문구를 보여 준다", () => {
    render(<EmptyState>등록된 교재가 없습니다.</EmptyState>);

    expect(screen.getByText("등록된 교재가 없습니다.")).toBeInTheDocument();
  });

  it("role 같은 접근성 속성을 그대로 전달한다", () => {
    render(<EmptyState role="status">출고 목록을 불러오는 중입니다.</EmptyState>);

    expect(screen.getByRole("status")).toHaveTextContent("출고 목록을 불러오는 중입니다.");
  });
});
