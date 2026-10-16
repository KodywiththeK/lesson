export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export type ListSortDirection = "asc" | "desc";

export type ListFilterValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>
  | undefined;

export type BuildListViewOptions<TItem> = {
  getName: (item: TItem) => string;
  /** 이름 대신 목록을 정렬할 기준 값. 비어 있는 값은 방향과 상관없이 맨 뒤에 둔다. */
  getSortValue?: (item: TItem) => string;
  /** `getSortValue` 기준 방향. 같은 값은 항상 이름 → 보조 기준 오름차순으로 고정한다. */
  sortDirection?: ListSortDirection;
  /** 이름이 같은 항목의 순서를 고정하는 보조 기준(보통 id). 페이지 경계의 중복·누락을 막는다. */
  getTieBreaker?: (item: TItem) => string;
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

/** 이름 정렬 기본 규칙: 숫자 크기 → 한글 가나다 → 영문. 대소문자는 구분하지 않는다. */
export function compareKoreanNames(left: string, right: string) {
  return collator.compare(left, right);
}

export type PageNumberItem = number | "ellipsis";

/** 페이지 이동 버튼에 보여줄 번호. 처음·끝·현재 앞뒤 한 페이지만 두고 나머지는 생략한다. */
export function buildPageNumbers(page: number, totalPages: number): PageNumberItem[] {
  const visiblePages = new Set(
    [1, page - 1, page, page + 1, totalPages].filter((number) => number >= 1 && number <= totalPages),
  );
  // 현재 페이지가 가장자리에 있어도 번호 개수가 크게 흔들리지 않게 앞/뒤 두 번째 페이지를 채운다.
  if (page <= 2) visiblePages.add(Math.min(2, totalPages));
  if (page >= totalPages - 1) visiblePages.add(Math.max(totalPages - 1, 1));
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const sorted = [...visiblePages].sort((left, right) => left - right);

  return sorted.flatMap((number, index): PageNumberItem[] => {
    const hiddenPages = index > 0 ? number - sorted[index - 1] - 1 : 0;
    if (hiddenPages === 0) return [number];
    // 한 페이지만 가리는 생략 부호는 번호를 그대로 보여주는 편이 낫다.
    return hiddenPages === 1 ? [number - 1, number] : ["ellipsis", number];
  });
}

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
    .sort((left, right) => compareListItems(left, right, options));

  return paginateItems(filteredItems, { page: options.page, pageSize });
}

function compareListItems<TItem>(
  left: TItem,
  right: TItem,
  options: BuildListViewOptions<TItem>,
) {
  return (
    compareBySortValue(left, right, options) ||
    compareKoreanNames(options.getName(left), options.getName(right)) ||
    compareKoreanNames(
      options.getTieBreaker?.(left) ?? "",
      options.getTieBreaker?.(right) ?? "",
    )
  );
}

function compareBySortValue<TItem>(
  left: TItem,
  right: TItem,
  options: BuildListViewOptions<TItem>,
) {
  if (!options.getSortValue) {
    return 0;
  }

  const leftValue = options.getSortValue(left);
  const rightValue = options.getSortValue(right);

  if (!leftValue || !rightValue) {
    return Number(!leftValue) - Number(!rightValue);
  }

  const result = compareKoreanNames(leftValue, rightValue);

  return options.sortDirection === "desc" ? -result : result;
}

/** 이미 원하는 순서로 정렬된 목록을 순서를 바꾸지 않고 해당 페이지만 잘라 `ListView`로 만든다. */
export function paginateItems<TItem>(
  items: TItem[],
  options: { page?: number; pageSize?: number },
): ListView<TItem> {
  const pageSize = normalizePageSize(options.pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = clampPage(options.page ?? 1, totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    pageSize,
    totalItems: items.length,
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
