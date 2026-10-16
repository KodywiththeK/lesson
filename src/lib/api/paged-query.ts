import { fetchAllPages } from "./fetch-all-pages";

type QueryResult<TRow> = {
  data: TRow[] | null;
  error: Error | null;
};

/** 목록 조회에서 쓰는 필터·정렬·범위 체인. `order`를 건 뒤 `range`로 한 페이지씩 읽는다. */
export type PagedSelectQuery<TRow> = PromiseLike<QueryResult<TRow>> & {
  eq(column: string, value: string): PagedSelectQuery<TRow>;
  is(column: string, value: null): PagedSelectQuery<TRow>;
  gte(column: string, value: string): PagedSelectQuery<TRow>;
  lte(column: string, value: string): PagedSelectQuery<TRow>;
  lt(column: string, value: string): PagedSelectQuery<TRow>;
  order(column: string, options?: { ascending?: boolean }): PagedSelectQuery<TRow>;
  range(from: number, to: number): PagedSelectQuery<TRow>;
};

/**
 * `fetchAllPages`로 끝까지 읽고, 실패하면 `${failureMessage}: ${원인}` 형태의 한국어 오류로 바꾼다.
 * 호출하는 쪽은 `fetchPage`의 쿼리에 `order`를 반드시 걸어야 한다.
 */
export async function fetchAllRows<TRow>(
  failureMessage: string,
  fetchPage: (from: number, to: number) => PromiseLike<QueryResult<TRow>>,
): Promise<TRow[]> {
  try {
    return await fetchAllPages(fetchPage);
  } catch (error) {
    throw new Error(`${failureMessage}: ${toErrorText(error)}`);
  }
}

function toErrorText(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return String(error);
}
