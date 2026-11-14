import {
  deleteBookRelease as deleteBookReleaseApi,
  registerBookReleases as registerBookReleasesApi,
  updateBookRelease as updateBookReleaseApi,
} from "@/lib/api/books";

import { requireBookSupabaseClient, type BookSupabaseClientState } from "./book-supabase";
import type { BookReleaseBatchRegistration, BookReleaseUpdate } from "./book-shipment-values";

export type BookShipmentOperationOverrides = {
  registerBookReleases?: (input: BookReleaseBatchRegistration) => void | Promise<void>;
  updateBookRelease?: (input: BookReleaseUpdate) => void | Promise<void>;
  deleteBookRelease?: (input: { releaseId: string }) => void | Promise<void>;
};

export type BookShipmentOperations = {
  register: (input: BookReleaseBatchRegistration) => Promise<void>;
  update: (input: BookReleaseUpdate) => Promise<void>;
  remove: (input: { releaseId: string }) => Promise<void>;
};

/** 데모·테스트가 넘긴 동작이 있으면 그것을, 없으면 Supabase API를 호출하는 동작 묶음. */
export function createBookShipmentOperations(
  academyId: string,
  clientState: BookSupabaseClientState | null,
  overrides: BookShipmentOperationOverrides,
): BookShipmentOperations {
  return {
    register: async (input) => {
      if (overrides.registerBookReleases) {
        await overrides.registerBookReleases(input);
        return;
      }

      await registerBookReleasesApi(requireBookSupabaseClient(clientState), { academyId, ...input });
    },
    update: async (input) => {
      if (overrides.updateBookRelease) {
        await overrides.updateBookRelease(input);
        return;
      }

      await updateBookReleaseApi(requireBookSupabaseClient(clientState), { academyId, ...input });
    },
    remove: async (input) => {
      if (overrides.deleteBookRelease) {
        await overrides.deleteBookRelease(input);
        return;
      }

      await deleteBookReleaseApi(requireBookSupabaseClient(clientState), { academyId, ...input });
    },
  };
}
