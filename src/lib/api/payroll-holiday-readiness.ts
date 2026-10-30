type HolidayScheduleClient = {
  rpc(name: "academy_holiday_month_ready" | "ensure_monthly_academy_lesson_events", payload: { p_academy_id: string; p_month: string }): PromiseLike<{ data: boolean | number | null; error: Error | null }>;
};

/** 급여 분모를 조회하기 전에 공식 공휴일을 확인하고 정기 수업의 제외 상태를 맞춘다. */
export async function preparePayrollHolidaySchedule(
  client: HolidayScheduleClient,
  academyId: string,
  month: string,
  fetchOfficial: (url: string, init: { method: string }) => Promise<{ ok: boolean }> = fetch,
): Promise<boolean> {
  const input = { p_academy_id: academyId, p_month: month };
  try {
    let ready = await client.rpc("academy_holiday_month_ready", input);
    if (ready.error) return false;
    if (ready.data !== true) {
      const response = await fetchOfficial(`/api/holidays?month=${encodeURIComponent(month)}`, { method: "POST" });
      if (!response.ok) return false;
      ready = await client.rpc("academy_holiday_month_ready", input);
      if (ready.error || ready.data !== true) return false;
    }
    const prepared = await client.rpc("ensure_monthly_academy_lesson_events", input);
    return !prepared.error;
  } catch {
    return false;
  }
}
