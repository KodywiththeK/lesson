import type { QueryKey } from "@tanstack/react-query";

import type { BookMutationSupabaseClient, BookReadSupabaseClient } from "@/lib/api/books";
import type { StudentListSupabaseClient } from "@/lib/api/students";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** 출고·결제 완료 화면이 Supabase에 직접 연결할 때 쓰는 client. 데모·테스트에서는 만들지 않는다. */
export type BookSupabaseClient = BookReadSupabaseClient & BookMutationSupabaseClient & StudentListSupabaseClient;

export type BookSupabaseClientState =
  | { client: BookSupabaseClient; error: null }
  | { client: null; error: Error };

type QueryOptionsOf<TData> = { queryKey: QueryKey; queryFn: () => Promise<TData> };

const UNAVAILABLE_MESSAGE = "Supabase client 상태를 만들지 못했습니다.";
const UNAVAILABLE_QUERY_KEY = ["books", "unavailable"] as const;

export function createBookSupabaseClientState(): BookSupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return { client: client as BookSupabaseClient, error: null };
  } catch (error) {
    return { client: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export function requireBookSupabaseClient(clientState: BookSupabaseClientState | null) {
  if (!clientState?.client) {
    throw new Error(UNAVAILABLE_MESSAGE);
  }

  return clientState.client;
}

/**
 * 조회 설정이 없으면(Supabase client를 만들지 못한 경우) 자리 표시 조회를 돌려준다.
 * 호출하는 화면은 `enabled`로 실행을 막고 오류를 따로 알리므로 이 조회는 실행되지 않는다.
 */
export function orUnavailableQueryOptions<TData>(
  options: QueryOptionsOf<TData> | null | undefined,
): QueryOptionsOf<TData> {
  return options ?? { queryKey: UNAVAILABLE_QUERY_KEY, queryFn: () => Promise.reject(new Error(UNAVAILABLE_MESSAGE)) };
}
