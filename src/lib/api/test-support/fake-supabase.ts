type Row = Record<string, unknown>;
type OrderOptions = { ascending?: boolean } | undefined;

/** 한 번의 `from(...).select(...)` 체인이 어떤 조건으로 호출됐는지 기록한다. */
export type FakeQueryRecord = {
  table: string;
  select?: string;
  eq: Array<[string, unknown]>;
  is: Array<[string, unknown]>;
  gte: Array<[string, unknown]>;
  lte: Array<[string, unknown]>;
  lt: Array<[string, unknown]>;
  order: Array<[string, OrderOptions]>;
  range: Array<[number, number]>;
};

export type FakeRpcCall = { functionName: string; payload: Record<string, unknown> };

type FakeSupabaseOptions = {
  /** 테이블 이름별로 조회 오류를 돌려주고 싶을 때. */
  errors?: Record<string, Error>;
  rpcResults?: Record<string, unknown>;
};

/**
 * 조회 체인(eq/is/gte/lte/lt/order/range)을 기록하고, `range`가 있으면 그 구간만 잘라 돌려주는 가짜 Supabase.
 * 필터는 적용하지 않는다. 어떤 조건을 걸었는지는 `queriesFor`로 확인한다.
 */
export function createFakeSupabase(
  rowsByTable: Record<string, Row[]>,
  options: FakeSupabaseOptions = {},
) {
  const queries: FakeQueryRecord[] = [];
  const rpcCalls: FakeRpcCall[] = [];

  const client = {
    from(table: string) {
      const record: FakeQueryRecord = {
        table,
        eq: [],
        is: [],
        gte: [],
        lte: [],
        lt: [],
        order: [],
        range: [],
      };
      queries.push(record);

      return {
        select(select: string) {
          record.select = select;

          return createQueryBuilder(record, rowsByTable[table] ?? [], options.errors?.[table] ?? null);
        },
      };
    },
    async rpc(functionName: string, payload: Record<string, unknown>) {
      rpcCalls.push({ functionName, payload });

      return { data: options.rpcResults?.[functionName] ?? null, error: null };
    },
  };

  return {
    client,
    queries,
    rpcCalls,
    queriesFor: (table: string) => queries.filter((query) => query.table === table),
  };
}

function createQueryBuilder(record: FakeQueryRecord, rows: Row[], error: Error | null) {
  const builder = {
    eq(column: string, value: unknown) {
      record.eq.push([column, value]);
      return builder;
    },
    is(column: string, value: unknown) {
      record.is.push([column, value]);
      return builder;
    },
    gte(column: string, value: unknown) {
      record.gte.push([column, value]);
      return builder;
    },
    lte(column: string, value: unknown) {
      record.lte.push([column, value]);
      return builder;
    },
    lt(column: string, value: unknown) {
      record.lt.push([column, value]);
      return builder;
    },
    order(column: string, orderOptions?: { ascending?: boolean }) {
      record.order.push([column, orderOptions]);
      return builder;
    },
    range(from: number, to: number) {
      record.range.push([from, to]);
      return builder;
    },
    then<TResult1 = { data: Row[] | null; error: Error | null }>(
      resolve?: (value: { data: Row[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>,
    ) {
      const lastRange = record.range.at(-1);
      const value = {
        data: error ? null : lastRange ? rows.slice(lastRange[0], lastRange[1] + 1) : rows,
        error,
      };

      return Promise.resolve(resolve ? resolve(value) : (value as TResult1));
    },
  };

  return builder;
}

export function createNumberedRows(count: number, build: (index: number) => Row): Row[] {
  return Array.from({ length: count }, (_, index) => build(index));
}
