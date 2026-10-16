const MINUTES_PER_HOUR = 60;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** 요일 이름(한글·영문)을 `Date#getUTCDay()` 기준 번호(일=0)로 바꾼다. */
const WEEKDAY_INDEX: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const NO_SCHEDULE_MESSAGE =
  "출근 요일·시간을 설정해 주세요. 선생님 정보에서 출근 일정을 등록하면 시급을 계산할 수 있습니다.";
const UNKNOWN_WEEKDAY_MESSAGE = "출근 요일을 확인해 주세요.";

export type ScheduledWorkMinutes =
  | { ok: true; minutes: number }
  | { ok: false; reason: string };

/** 출근 일정 한 줄. `TeacherWorkSchedule`(목록 행)과 요일 키만 있는 형태를 모두 받는다. */
export type WorkScheduleLike = {
  weekday: string;
  weekdayLabel?: string;
  startTime?: string;
  endTime?: string;
};

export type CalculateScheduledWorkMinutesInput = {
  /** 한국 시간(KST) 달력 기준 `YYYY-MM`. */
  month: string;
  schedules: WorkScheduleLike[] | undefined;
  /** 계약 시작일·종료일(`YYYY-MM-DD`, 양 끝 포함). 없으면 그 달 전체를 대상으로 한다. */
  contractStartOn?: string;
  contractEndOn?: string;
};

type ResolvedSchedule = { dayIndex: number; minutesPerDay: number };

/**
 * 시급제 급여의 근무 시간: 선생님의 출근 요일·시간을 그 달 날짜에 펼쳐 계약 기간 안의 날짜만 정수 분으로 합산한다.
 * 서버 `mark_salary_settlement_paid`의 시급 재계산과 같은 규칙이므로 한쪽을 바꾸면 다른 쪽도 함께 바꾼다.
 * 근무표가 비었거나 시간이 비어 있으면 계산하지 않고 사용자 안내 문구(`reason`)를 돌려준다.
 */
export function calculateScheduledWorkMinutes(
  input: CalculateScheduledWorkMinutesInput,
): ScheduledWorkMinutes {
  const monthMatch = input.month.match(MONTH_PATTERN);

  if (!monthMatch) {
    throw new Error("월은 YYYY-MM 형식이어야 합니다.");
  }

  const schedules = input.schedules ?? [];

  if (schedules.length === 0) {
    return { ok: false, reason: NO_SCHEDULE_MESSAGE };
  }

  const resolved = resolveSchedules(schedules);

  if (!resolved.ok) {
    return resolved;
  }

  const dayCounts = countContractDaysByWeekday(
    { year: Number(monthMatch[1]), month: Number(monthMatch[2]) },
    input,
  );
  const minutes = resolved.schedules.reduce(
    (total, schedule) => total + schedule.minutesPerDay * dayCounts[schedule.dayIndex],
    0,
  );

  return { ok: true, minutes };
}

/** 분을 "38시간 30분"처럼 읽기 쉬운 문구로 바꾼다. */
export function formatWorkDuration(minutes: number) {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `${rest}분`;
  }

  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

function resolveSchedules(
  schedules: WorkScheduleLike[],
): { ok: true; schedules: ResolvedSchedule[] } | { ok: false; reason: string } {
  const resolved: ResolvedSchedule[] = [];
  const labelsWithoutTime: string[] = [];

  for (const schedule of schedules) {
    const dayIndex = WEEKDAY_INDEX[schedule.weekdayLabel ?? schedule.weekday] ?? WEEKDAY_INDEX[schedule.weekday];

    if (dayIndex === undefined) {
      return { ok: false, reason: UNKNOWN_WEEKDAY_MESSAGE };
    }

    const label = schedule.weekdayLabel ?? schedule.weekday;
    const start = readMinuteOfDay(schedule.startTime);
    const end = readMinuteOfDay(schedule.endTime);

    if (start === undefined || end === undefined) {
      labelsWithoutTime.push(label);
      continue;
    }

    if (end <= start) {
      return {
        ok: false,
        reason: `출근 시간을 확인해 주세요. ${label}요일의 종료 시간이 시작 시간보다 늦어야 합니다.`,
      };
    }

    resolved.push({ dayIndex, minutesPerDay: end - start });
  }

  if (labelsWithoutTime.length > 0) {
    return {
      ok: false,
      reason: `출근 시간을 설정해 주세요. ${labelsWithoutTime.join("·")}요일의 시작·종료 시간이 비어 있습니다.`,
    };
  }

  return { ok: true, schedules: resolved };
}

/** `HH:mm`·`HH:mm:ss`에서 시·분만 읽는다(서버도 초는 보지 않는다). */
function readMinuteOfDay(time: string | undefined) {
  const match = time?.match(/^(\d{2}):(\d{2})/);

  return match ? Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]) : undefined;
}

/** 그 달 날짜 중 계약 기간 안에 드는 날짜를 요일별(일=0)로 센다. 날짜 계산은 UTC 기준 달력 날짜만 쓰므로 실행 환경 시간대와 무관하다. */
function countContractDaysByWeekday(
  { year, month }: { year: number; month: number },
  contract: Pick<CalculateScheduledWorkMinutesInput, "contractStartOn" | "contractEndOn">,
) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthPrefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  const startOn = contract.contractStartOn?.slice(0, 10);
  const endOn = contract.contractEndOn?.slice(0, 10);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthPrefix}-${String(day).padStart(2, "0")}`;

    if ((startOn && date < startOn) || (endOn && date > endOn)) {
      continue;
    }

    counts[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] += 1;
  }

  return counts;
}
