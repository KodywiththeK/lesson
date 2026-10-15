"use client";

import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  PAGE_SIZE_OPTIONS,
  buildPageNumbers,
  type ListView,
  type PageSizeOption,
} from "@/domain/common-list";

type ListPaginationProps = {
  /** 접근 가능한 이름에 쓰는 목록 대상. 예: 원생, 선생님 */
  itemLabel: string;
  /** 건수 단위. 예: 명, 개, 건 */
  countUnit?: string;
  view: Pick<ListView<unknown>, "page" | "pageSize" | "totalItems" | "totalPages" | "hasPreviousPage" | "hasNextPage">;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSizeOption) => void;
};

/** 모든 관리 목록이 같이 쓰는 총 건수, 페이지 번호 이동, 페이지당 개수(10·20·30) 선택. 항상 보인다. */
export function ListPagination({
  itemLabel,
  countUnit = "개",
  view,
  onPageChange,
  onPageSizeChange,
}: ListPaginationProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        총 {view.totalItems}
        {countUnit}
      </p>
      <Pagination aria-label={`${itemLabel} 목록 페이지`} className="mx-0 w-auto justify-start">
        <PaginationContent className="flex-wrap">
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="이전 페이지"
              disabled={!view.hasPreviousPage}
              onClick={() => onPageChange(view.page - 1)}
            >
              이전
            </Button>
          </PaginationItem>
          {buildPageNumbers(view.page, view.totalPages).map((item, index) => (
            <Fragment key={`${item}-${index}`}>
              {item === "ellipsis" ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem>
                  <Button
                    type="button"
                    variant={item === view.page ? "default" : "ghost"}
                    size="sm"
                    aria-label={`${item}페이지`}
                    aria-current={item === view.page ? "page" : undefined}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </Button>
                </PaginationItem>
              )}
            </Fragment>
          ))}
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="다음 페이지"
              disabled={!view.hasNextPage}
              onClick={() => onPageChange(view.page + 1)}
            >
              다음
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <Label className="flex items-center gap-2 text-sm">
        <span>페이지당</span>
        <NativeSelect
          aria-label={`페이지당 ${itemLabel} 수`}
          value={String(view.pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSizeOption)}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <NativeSelectOption key={size} value={String(size)}>
              {size}
              {countUnit}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
    </div>
  );
}
