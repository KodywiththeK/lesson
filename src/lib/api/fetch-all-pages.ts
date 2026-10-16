type PageResult<TRow> = {
  data: TRow[] | null;
  error: Error | null;
};

/** 서버 `max_rows`(1000)를 넘는 조회가 조용히 잘리지 않도록 1000건씩 끝까지 읽는다. */
export const DEFAULT_FETCH_PAGE_SIZE = 1000;
/** 이 이상은 조회 범위를 좁혀야 하는 규모이므로 끝없이 읽지 않고 오류로 알린다. */
export const MAX_FETCH_PAGES = 50;

/**
 * `fetchPage(from, to)`는 `order`로 순서를 고정한 쿼리에 `.range(from, to)`를 건 결과를 돌려준다.
 * 순서가 고정되지 않으면 페이지 사이에 행이 겹치거나 빠질 수 있으므로 호출하는 쪽이 `order`를 반드시 건다.
 */
export async function fetchAllPages<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<TRow>>,
  pageSize: number = DEFAULT_FETCH_PAGE_SIZE,
): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let page = 0; page < MAX_FETCH_PAGES; page += 1) {
    const from = page * pageSize;
    const { data, error } = await fetchPage(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return rows;
    }
  }

  throw new Error("데이터가 너무 많아 모두 불러오지 못했습니다. 조회 기간을 좁혀 주세요.");
}
