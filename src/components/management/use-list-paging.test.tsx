import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useListPaging } from "./use-list-paging";

describe("useListPaging", () => {
  it("1페이지, 10개로 시작한다", () => {
    const { result } = renderHook(() => useListPaging());

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
  });

  it("페이지 크기를 바꾸면 1페이지로 돌아간다", () => {
    const { result } = renderHook(() => useListPaging());

    act(() => result.current.goToPage(3));
    act(() => result.current.changePageSize(30));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(30);
  });

  it("검색이나 필터가 바뀌면 resetPage로 1페이지로 돌아간다", () => {
    const { result } = renderHook(() => useListPaging());

    act(() => result.current.goToPage(4));
    act(() => result.current.resetPage());

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
  });
});
