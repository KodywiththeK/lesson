type SupabaseBrowserEnv = Record<string, string | undefined>;

export type SupabaseBrowserConfig = {
  url: string;
  publishableKey: string;
};

export function getSupabaseBrowserConfig(
  env?: SupabaseBrowserEnv,
): SupabaseBrowserConfig {
  const url = env
    ? env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env
    ? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 필요합니다.");
  }

  if (!publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.",
    );
  }

  return {
    url,
    publishableKey,
  };
}
