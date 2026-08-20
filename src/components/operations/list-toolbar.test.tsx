import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OperationsListToolbar } from "./list-toolbar";

describe("OperationsListToolbar", () => {
  it("검색 입력과 10/20/30 페이지 크기 선택지를 제공한다", () => {
    render(
      <OperationsListToolbar
        searchLabel="원생 검색"
        searchValue=""
        onSearchChange={vi.fn()}
        pageSize={10}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "원생 검색" })).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "페이지 크기" });
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "10개",
      "20개",
      "30개",
    ]);
  });

  it("필터 select를 label과 option으로 렌더링한다", () => {
    render(
      <OperationsListToolbar
        searchLabel="교재 검색"
        searchValue="바이엘"
        onSearchChange={vi.fn()}
        pageSize={20}
        onPageSizeChange={vi.fn()}
        filters={[
          {
            label: "상태",
            value: "pending",
            options: [
              { label: "전체", value: "" },
              { label: "결제 대기", value: "pending" },
              { label: "결제 완료", value: "paid" },
            ],
            onChange: vi.fn(),
          },
        ]}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "교재 검색" })).toHaveValue("바이엘");
    const statusFilter = screen.getByRole("combobox", { name: "상태" });
    expect(statusFilter).toHaveValue("pending");
  });
});
