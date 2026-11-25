import { createClient } from "@supabase/supabase-js";

type ServerEnv = Record<string, string | undefined>;

/**
 * 서버 route handler 전용 service_role 클라이언트. RLS를 건너뛰므로 브라우저 코드에서 import하지 않는다.
 * 환경변수가 없으면 null을 돌려 호출한 쪽이 503으로 답하게 한다.
 */
export function createSupabaseServiceRoleClient(env: ServerEnv = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secret) {
    return null;
  }

  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
