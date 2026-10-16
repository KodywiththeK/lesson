import { describe, expect, it } from "vitest";

import {
  calculateScheduledWorkMinutes,
  formatWorkDuration,
} from "./teacher-work-minutes";

const monday = { weekday: "월", weekdayLabel: "월", startTime: "10:00", endTime: "18:00" };
const wednesday = { weekday: "wednesday", weekdayLabel: "수", startTime: "13:00", endTime: "17:30" };

describe("calculateScheduledWorkMinutes", () => {
  it("출근 요일·시간을 해당 월(한국 달력)의 날짜에 펼쳐 분 단위로 합산한다", () => {
    // 2026-08: 월요일 5번(3·10·17·24·31), 수요일 4번(5·12·19·26)
    expect(
      calculateScheduledWorkMinutes({ month: "2026-08", schedules: [monday, wednesday] }),
    ).toEqual({ ok: true, minutes: 5 * 480 + 4 * 270 });
  });

  it("월의 첫날과 마지막 날도 포함한다(2026-08-01 토, 2026-08-31 월)", () => {
    const saturday = { weekday: "토", weekdayLabel: "토", startTime: "09:00", endTime: "10:00" };

    expect(calculateScheduledWorkMinutes({ month: "2026-08", schedules: [saturday] })).toEqual({
      ok: true,
      minutes: 5 * 60,
    });
    expect(calculateScheduledWorkMinutes({ month: "2026-08", schedules: [monday] })).toEqual({
      ok: true,
      minutes: 5 * 480,
    });
  });

  it("계약 시작일·종료일 당일은 포함하고 그 밖의 날짜는 제외한다", () => {
    expect(
      calculateScheduledWorkMinutes({
        month: "2026-08",
        schedules: [monday],
        contractStartOn: "2026-08-10",
        contractEndOn: "2026-08-24",
      }),
    ).toEqual({ ok: true, minutes: 3 * 480 });
  });

  it("계약이 그 달 중간에 시작·종료하면 겹치는 날짜만 센다", () => {
    expect(
      calculateScheduledWorkMinutes({
        month: "2026-08",
        schedules: [monday],
        contractStartOn: "2026-07-15",
        contractEndOn: "2026-08-03",
      }),
    ).toEqual({ ok: true, minutes: 480 });
  });

  it("계약 기간이 그 달과 겹치지 않으면 0분이다", () => {
    expect(
      calculateScheduledWorkMinutes({
        month: "2026-08",
        schedules: [monday],
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
      }),
    ).toEqual({ ok: true, minutes: 0 });
  });

  it("계약일 정보가 없으면 그 달 전체를 대상으로 한다", () => {
    expect(calculateScheduledWorkMinutes({ month: "2026-08", schedules: [monday] })).toEqual({
      ok: true,
      minutes: 5 * 480,
    });
  });

  it("2월은 윤년 여부에 따라 날짜 수가 달라진다", () => {
    const sunday = { weekday: "일", weekdayLabel: "일", startTime: "10:00", endTime: "11:00" };

    // 2028-02-29는 화요일, 2028-02 일요일은 6·13·20·27 → 4번
    expect(calculateScheduledWorkMinutes({ month: "2028-02", schedules: [sunday] })).toEqual({
      ok: true,
      minutes: 4 * 60,
    });
    const tuesday = { weekday: "화", weekdayLabel: "화", startTime: "10:00", endTime: "11:00" };
    expect(calculateScheduledWorkMinutes({ month: "2028-02", schedules: [tuesday] })).toEqual({
      ok: true,
      minutes: 5 * 60,
    });
    expect(calculateScheduledWorkMinutes({ month: "2027-02", schedules: [tuesday] })).toEqual({
      ok: true,
      minutes: 4 * 60,
    });
  });

  it("영문 요일 키와 초 단위 시간(HH:mm:ss)도 읽는다", () => {
    expect(
      calculateScheduledWorkMinutes({
        month: "2026-08",
        schedules: [{ weekday: "monday", startTime: "10:00:00", endTime: "11:30:00" }],
      }),
    ).toEqual({ ok: true, minutes: 5 * 90 });
  });

  it("근무표가 비어 있으면 출근 요일·시간을 등록하라는 안내를 돌려준다", () => {
    const expected = {
      ok: false,
      reason: "출근 요일·시간을 설정해 주세요. 선생님 정보에서 출근 일정을 등록하면 시급을 계산할 수 있습니다.",
    };

    expect(calculateScheduledWorkMinutes({ month: "2026-08", schedules: [] })).toEqual(expected);
    expect(calculateScheduledWorkMinutes({ month: "2026-08", schedules: undefined })).toEqual(expected);
  });

  it("출근 요일은 있는데 시간이 비어 있으면 어느 요일인지 알려 주며 출근 시간 설정을 안내한다", () => {
    expect(
      calculateScheduledWorkMinutes({
        month: "2026-08",
        schedules: [monday, { weekday: "수", weekdayLabel: "수" }, { weekday: "금", weekdayLabel: "금", startTime: "10:00" }],
      }),
    ).toEqual({
      ok: false,
      reason: "출근 시간을 설정해 주세요. 수·금요일의 시작·종료 시간이 비어 있습니다.",
    });
  });

  it("종료 시간이 시작 시간보다 늦지 않으면 계산하지 않고 안내한다", () => {
    expect(
      calculateScheduledWorkMinutes({
        month: "2026-08",
        schedules: [{ weekday: "월", weekdayLabel: "월", startTime: "18:00", endTime: "10:00" }],
      }),
    ).toEqual({
      ok: false,
      reason: "출근 시간을 확인해 주세요. 월요일의 종료 시간이 시작 시간보다 늦어야 합니다.",
    });
  });

  it("알 수 없는 요일 값은 조용히 0분으로 두지 않고 안내한다", () => {
    expect(
      calculateScheduledWorkMinutes({
        month: "2026-08",
        schedules: [{ weekday: "someday", startTime: "10:00", endTime: "11:00" }],
      }),
    ).toEqual({ ok: false, reason: "출근 요일을 확인해 주세요." });
  });

  it("형식이 올바르지 않은 월은 오류로 알린다", () => {
    expect(() => calculateScheduledWorkMinutes({ month: "2026-8", schedules: [monday] })).toThrow(
      "월은 YYYY-MM 형식이어야 합니다.",
    );
  });
});

describe("formatWorkDuration", () => {
  it("분을 시간·분 문구로 바꾼다", () => {
    expect(formatWorkDuration(0)).toBe("0분");
    expect(formatWorkDuration(40)).toBe("40분");
    expect(formatWorkDuration(120)).toBe("2시간");
    expect(formatWorkDuration(2310)).toBe("38시간 30분");
  });
});
