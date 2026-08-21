import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getSupabaseBrowserConfig } from "./env";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseBrowserConfig();

  return createBrowserClient<Database>(url, publishableKey);
}
