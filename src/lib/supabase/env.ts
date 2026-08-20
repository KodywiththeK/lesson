type SupabaseBrowserEnv = Record<string, string | undefined>;

export type SupabaseBrowserConfig = {
  url: string;
  anonKey: string;
};

export function getSupabaseBrowserConfig(
  env: SupabaseBrowserEnv = process.env,
): SupabaseBrowserConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 필요합니다.");
  }

  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.");
  }

  return {
    url,
    anonKey,
  };
}
