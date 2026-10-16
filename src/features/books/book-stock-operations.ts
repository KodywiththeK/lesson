import type { BookStockInput, BookStockRow } from "@/domain/book-stock";
import {
  fetchPendingBookReleaseCount,
  deleteBook as deleteBookApi,
  registerBookStock as registerBookStockApi,
  updateBook as updateBookApi,
  type BookMutationSupabaseClient,
  type BookReadSupabaseClient,
} from "@/lib/api/books";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type BookUpdateInput = BookStockInput & { bookId: string };

type BookSupabaseClient = BookReadSupabaseClient & BookMutationSupabaseClient;

export type SupabaseClientState =
  | { client: BookSupabaseClient; error: null }
  | { client: null; error: Error };

/** 데모·테스트가 넘기는 동작. 없으면 Supabase API를 호출한다. 등록은 서버가 합산한 교재를 돌려줄 수 있다. */
export type BookStockOperationOverrides = {
  registerBook?: (input: BookStockInput) => void | BookStockRow | Promise<void | BookStockRow>;
  updateBook?: (input: BookUpdateInput) => void | Promise<void>;
  deleteBook?: (input: { bookId: string }) => void | Promise<void>;
  /** 이 교재로 아직 결제 대기 중인 출고 건수. 데모는 상태에서 세고, 운영은 출고 목록을 읽어 센다. */
  countPendingReleases?: (book: BookStockRow) => number | Promise<number>;
};

export type BookStockOperations = {
  register: (input: BookStockInput) => Promise<BookStockRow | undefined>;
  update: (input: BookUpdateInput) => Promise<void>;
  remove: (input: { bookId: string }) => Promise<void>;
  /** 건수를 셀 방법이 없으면(연결 실패 등) undefined. 그러면 대기 출고 안내를 생략한다. */
  countPendingReleases: ((book: BookStockRow) => Promise<number>) | undefined;
};

export function createBookStockOperations(
  academyId: string,
  supabaseClientState: SupabaseClientState | null,
  overrides: BookStockOperationOverrides,
): BookStockOperations {
  const client = supabaseClientState?.client ?? null;
  const countPendingReleasesOverride = overrides.countPendingReleases;

  return {
    register: async (input) => {
      const saved = overrides.registerBook
        ? await overrides.registerBook(input)
        : await registerBookStockApi(requireSupabaseClient(supabaseClientState), { academyId, ...input });

      return typeof saved === "object" ? saved : undefined;
    },
    update: async (input) => {
      if (overrides.updateBook) {
        await overrides.updateBook(input);
        return;
      }

      await updateBookApi(requireSupabaseClient(supabaseClientState), { academyId, ...input });
    },
    remove: async (input) => {
      if (overrides.deleteBook) {
        await overrides.deleteBook(input);
        return;
      }

      await deleteBookApi(requireSupabaseClient(supabaseClientState), { academyId, ...input });
    },
    countPendingReleases: countPendingReleasesOverride
      ? async (book) => countPendingReleasesOverride(book)
      : client
        ? (book) => fetchPendingBookReleaseCount(client, { academyId, bookId: book.bookId })
        : undefined,
  };
}

export function requireSupabaseClient(supabaseClientState: SupabaseClientState | null) {
  if (!supabaseClientState?.client) {
    throw new Error("Supabase client 상태를 만들지 못했습니다.");
  }

  return supabaseClientState.client;
}

export function createSupabaseClientState(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return { client: client as BookSupabaseClient, error: null };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
