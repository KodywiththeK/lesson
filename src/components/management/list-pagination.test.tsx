import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ListView } from "@/domain/common-list";

import { ListPagination } from "./list-pagination";

function buildView(overrides: Partial<ListView<unknown>> = {}): ListView<unknown> {
  return {
    items: [],
    page: 1,
    pageSize: 10,
    totalItems: 25,
    totalPages: 3,
    hasPreviousPage: false,
    hasNextPage: true,
    ...overrides,
  };
}

describe("ListPagination", () => {
  it("총 건수, 페이지 번호, 페이지당 개수를 항상 보여준다", () => {
    render(
      <ListPagination
        itemLabel="원생"
        countUnit="명"
        view={buildView({ totalItems: 3, totalPages: 1, hasNextPage: false })}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("총 3명")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("combobox", { name: "페이지당 원생 수" })).toHaveValue("10");
    expect(screen.getByRole("button", { name: "이전 페이지" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled();
  });

  it("페이지 번호와 이전·다음 버튼으로 이동한다", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <ListPagination
        itemLabel="선생님"
        view={buildView({ page: 2, hasPreviousPage: true })}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await user.click(screen.getByRole("button", { name: "이전 페이지" }));
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(onPageChange.mock.calls.map(([page]) => page)).toEqual([3, 1, 3]);
  });

  it("10개, 20개, 30개 중에서 페이지당 개수를 고른다", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <ListPagination
        itemLabel="거래처"
        view={buildView()}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    const select = screen.getByRole("combobox", { name: "페이지당 거래처 수" });
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "10개",
      "20개",
      "30개",
    ]);

    await user.selectOptions(select, "30");

    expect(onPageSizeChange).toHaveBeenCalledWith(30);
  });

  it("페이지가 많으면 생략 표시로 번호를 줄인다", () => {
    render(
      <ListPagination
        itemLabel="원생"
        view={buildView({ page: 5, totalItems: 100, totalPages: 10, hasPreviousPage: true })}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    const pageButtons = screen
      .getAllByRole("button", { name: /^\d+페이지$/ })
      .map((button) => button.textContent);
    expect(pageButtons).toEqual(["1", "4", "5", "6", "10"]);
  });
});
