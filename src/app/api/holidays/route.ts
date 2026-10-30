import { parseKoreanHolidayResponse } from "@/domain/korean-holiday";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const HOLIDAY_ERROR = "공휴일 자료를 불러오지 못했습니다. 다시 시도해 주세요.";
const KASI_ENDPOINT = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return Response.json({ error: "조회할 달을 확인해 주세요." }, { status: 400 });
  }
  const apiKey = process.env.KASI_HOLIDAY_API_KEY;
  if (!apiKey) return Response.json({ error: HOLIDAY_ERROR }, { status: 503 });

  try {
    const url = new URL(KASI_ENDPOINT);
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("solYear", month.slice(0, 4));
    url.searchParams.set("solMonth", month.slice(5, 7));
    url.searchParams.set("numOfRows", "40");
    url.searchParams.set("_type", "json");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const holidays = parseKoreanHolidayResponse(await response.json());
    if (holidays.some((item) => !item.date.startsWith(`${month}-`))) throw new Error("조회한 달의 공휴일 자료가 아닙니다.");
    return Response.json({ holidays });
  } catch {
    return Response.json({ error: HOLIDAY_ERROR }, { status: 503 });
  }
}

/** 서버에서 확인한 공식 응답만 정기 일정 생성에 사용할 수 있도록 기록한다. */
export async function POST(request: Request) {
  try {
    const session = await createSupabaseServerClient();
    const { data, error } = await session.auth.getUser();
    if (error || !data.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const officialResponse = await GET(request);
    if (!officialResponse.ok) return officialResponse;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secret) return Response.json({ error: HOLIDAY_ERROR }, { status: 503 });
    const { holidays } = await officialResponse.json();
    const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await client.rpc("store_verified_korean_holidays", {
      p_month: new URL(request.url).searchParams.get("month"), p_holidays: holidays,
    });
    if (result.error) throw result.error;
    return Response.json({ holidays });
  } catch {
    return Response.json({ error: HOLIDAY_ERROR }, { status: 503 });
  }
}
