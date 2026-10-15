"use client";

import { useCallback, useState } from "react";

import { DEFAULT_PAGE_SIZE, type PageSizeOption } from "@/domain/common-list";

/** 목록 화면이 같이 쓰는 페이지 상태. 검색·필터·페이지 크기가 바뀌면 1페이지로 돌아가야 한다. */
export function useListPaging() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);

  const resetPage = useCallback(() => setPage(1), []);
  const changePageSize = useCallback((nextPageSize: PageSizeOption) => {
    setPageSize(nextPageSize);
    setPage(1);
  }, []);

  return { page, pageSize, goToPage: setPage, changePageSize, resetPage };
}
