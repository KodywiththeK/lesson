import { Search } from "lucide-react";

import { PAGE_SIZE_OPTIONS, type PageSizeOption } from "@/domain/common-list";

export type OperationsListFilter = {
  label: string;
  value: string;
  options: Array<{
    label: string;
    value: string;
  }>;
  onChange: (value: string) => void;
};

export type OperationsListToolbarProps = {
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  pageSize: PageSizeOption;
  onPageSizeChange: (value: PageSizeOption) => void;
  filters?: OperationsListFilter[];
};

export function OperationsListToolbar({
  searchLabel,
  searchValue,
  onSearchChange,
  pageSize,
  onPageSizeChange,
  filters = [],
}: OperationsListToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
      <label className="relative min-w-0 flex-1 md:max-w-sm">
        <span className="sr-only">{searchLabel}</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          aria-label={searchLabel}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
          placeholder={searchLabel}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <label key={filter.label} className="grid gap-1">
            <span className="sr-only">{filter.label}</span>
            <select
              aria-label={filter.label}
              value={filter.value}
              onChange={(event) => filter.onChange(event.target.value)}
              className="h-10 min-w-28 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label className="grid gap-1">
          <span className="sr-only">페이지 크기</span>
          <select
            aria-label="페이지 크기"
            value={pageSize}
            onChange={(event) =>
              onPageSizeChange(Number(event.target.value) as PageSizeOption)
            }
            className="h-10 min-w-24 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}개
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
