export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export type ListFilterValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>
  | undefined;

export type BuildListViewOptions<TItem> = {
  getName: (item: TItem) => string;
  search?: string;
  searchFields?: Array<(item: TItem) => string | number | undefined>;
  filters?: Record<string, ListFilterValue>;
  filterFields?: Record<
    string,
    (item: TItem) => string | number | boolean | undefined
  >;
  page?: number;
  pageSize?: number;
};

export type ListView<TItem> = {
  items: TItem[];
  page: number;
  pageSize: PageSizeOption;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

const collator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

export function normalizePageSize(pageSize: number | undefined): PageSizeOption {
  if (PAGE_SIZE_OPTIONS.includes(pageSize as PageSizeOption)) {
    return pageSize as PageSizeOption;
  }

  return DEFAULT_PAGE_SIZE;
}

export function buildListView<TItem>(
  items: TItem[],
  options: BuildListViewOptions<TItem>,
): ListView<TItem> {
  const pageSize = normalizePageSize(options.pageSize);
  const filteredItems = items
    .filter((item) => matchesSearch(item, options))
    .filter((item) => matchesFilters(item, options))
    .sort((left, right) =>
      collator.compare(options.getName(left), options.getName(right)),
    );
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = clampPage(options.page ?? 1, totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    items: filteredItems.slice(startIndex, startIndex + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

function matchesSearch<TItem>(
  item: TItem,
  options: BuildListViewOptions<TItem>,
) {
  const search = options.search?.trim().toLocaleLowerCase("ko-KR");

  if (!search) {
    return true;
  }

  const searchFields = options.searchFields ?? [options.getName];

  return searchFields.some((field) =>
    String(field(item) ?? "")
      .toLocaleLowerCase("ko-KR")
      .includes(search),
  );
}

function matchesFilters<TItem>(
  item: TItem,
  options: BuildListViewOptions<TItem>,
) {
  if (!options.filters || !options.filterFields) {
    return true;
  }

  return Object.entries(options.filters).every(([filterKey, expected]) => {
    if (expected === undefined || expected === "") {
      return true;
    }

    const field = options.filterFields?.[filterKey];

    if (!field) {
      return true;
    }

    const actual = field(item);

    if (Array.isArray(expected)) {
      return expected.includes(actual ?? "");
    }

    return actual === expected;
  });
}

function clampPage(page: number, totalPages: number) {
  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return Math.min(page, totalPages);
}
