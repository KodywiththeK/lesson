import { describe, expect, it, vi } from "vitest";
import { preparePayrollHolidaySchedule } from "./payroll-holiday-readiness";

describe("급여의 휴일 배정 준비", () => {
  it("검증된 월이면 먼저 정기 수업을 준비한다", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: 0, error: null });
    const fetchOfficial = vi.fn();
    expect(await preparePayrollHolidaySchedule({ rpc }, "academy", "2026-10", fetchOfficial)).toBe(true);
    expect(fetchOfficial).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith("ensure_monthly_academy_lesson_events", { p_academy_id: "academy", p_month: "2026-10" });
  });
  it("검증되지 않은 월을 공식 자료로 확인할 수 없으면 미준비로 알린다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const fetchOfficial = vi.fn().mockResolvedValue({ ok: false });
    expect(await preparePayrollHolidaySchedule({ rpc }, "academy", "2026-10", fetchOfficial)).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("공식 조회 후 DB 준비 상태를 다시 확인한다", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null }).mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: 0, error: null });
    const fetchOfficial = vi.fn().mockResolvedValue({ ok: true });
    expect(await preparePayrollHolidaySchedule({ rpc }, "academy", "2026-10", fetchOfficial)).toBe(true);
    expect(fetchOfficial).toHaveBeenCalledWith("/api/holidays?month=2026-10", { method: "POST" });
  });
});
