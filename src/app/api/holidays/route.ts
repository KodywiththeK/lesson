import { parseKoreanHolidayResponse } from "@/domain/korean-holiday";

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
    const response = await fetch(url, { next: { revalidate: 86_400 } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const holidays = parseKoreanHolidayResponse(await response.json())
      .filter((item) => item.date.startsWith(month));
    return Response.json({ holidays });
  } catch {
    return Response.json({ error: HOLIDAY_ERROR }, { status: 503 });
  }
}
