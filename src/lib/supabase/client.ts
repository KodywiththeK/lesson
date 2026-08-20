import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseBrowserConfig } from "./env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseBrowserConfig();

  return createBrowserClient(url, anonKey);
}
