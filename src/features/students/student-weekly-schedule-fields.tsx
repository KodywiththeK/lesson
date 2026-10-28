import { TimeField } from "@/components/operations/date-time-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { calculateLessonEndTime } from "@/domain/student-registration";

import { selectableWeekdayOptions, weekdayOptions } from "./student-form-options";

export type WeeklyScheduleDraft = {
  weekday: string;
  startTime?: string;
  endTime?: string;
};

/**
 * 수강 요일을 고르고 요일마다 시작·종료 시간을 입력한다. 원생 등록과 수정 폼이 함께 쓴다.
 * `labelPrefix`는 한 화면에 악기 카드가 여러 개일 때 접근 가능한 이름을 구분한다.
 * 선택지는 월~토이고, 이전 데이터에 저장된 요일(`legacyWeekdays`, 예: 일요일)만 추가로 보여 준다.
 */
export function WeeklyScheduleFields({
  legend,
  labelPrefix = "",
  schedules,
  legacyWeekdays = [],
  lessonType = "academy",
  lessonDurationMinutes = 40,
  onChange,
}: {
  legend: string;
  labelPrefix?: string;
  legacyWeekdays?: string[];
  lessonType?: "academy" | "private";
  lessonDurationMinutes?: number;
  schedules: WeeklyScheduleDraft[];
  onChange: (schedules: WeeklyScheduleDraft[]) => void;
}) {
  const withPrefix = (text: string) => `${labelPrefix}${text}`;
  const visibleWeekdays = weekdayOptions.filter(
    (weekday) =>
      selectableWeekdayOptions.includes(weekday) || legacyWeekdays.includes(weekday.value),
  );

  function updateSchedule(weekday: string, patch: Partial<WeeklyScheduleDraft>) {
    onChange(
      schedules.map((schedule) =>
        schedule.weekday === weekday ? { ...schedule, ...patch } : schedule,
      ),
    );
  }

  return (
    <>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{legend}</legend>
        <div className="flex flex-wrap gap-3 rounded-md border border-border bg-muted/40 p-3">
          {visibleWeekdays.map((weekday) => (
            <Label key={weekday.value} className="flex items-center gap-2">
              <Checkbox
                aria-label={withPrefix(`${weekday.label}요일`)}
                checked={schedules.some((schedule) => schedule.weekday === weekday.value)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...schedules, { weekday: weekday.value }]
                      : schedules.filter((schedule) => schedule.weekday !== weekday.value),
                  )
                }
              />
              <span>{weekday.label}</span>
            </Label>
          ))}
        </div>
      </fieldset>

      {schedules.length > 0 ? (
        <div className="grid gap-2">
          {schedules.map((schedule) => {
            const weekdayLabel =
              weekdayOptions.find((weekday) => weekday.value === schedule.weekday)?.label ??
              schedule.weekday;

            return (
              <div key={schedule.weekday} className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr]">
                <span className="self-center text-sm font-medium">{weekdayLabel}</span>
                <TimeField
                  aria-label={withPrefix(`${weekdayLabel} 시작 시간`)}
                  value={schedule.startTime ?? ""}
                  onValueChange={(startTime) => updateSchedule(schedule.weekday, {
                    startTime,
                    ...(lessonType === "private"
                      ? { endTime: calculateLessonEndTime(startTime || undefined, lessonDurationMinutes || undefined) }
                      : {}),
                  })}
                />
                {lessonType === "private" ? (
                  <Input
                    aria-label={withPrefix(`${weekdayLabel} 종료 시간`)}
                    readOnly
                    value={calculateLessonEndTime(schedule.startTime, lessonDurationMinutes || undefined) ?? ""}
                    placeholder="시작 시간 선택 시 자동 계산"
                  />
                ) : (
                  <TimeField
                    aria-label={withPrefix(`${weekdayLabel} 종료 시간`)}
                    value={schedule.endTime ?? ""}
                    onValueChange={(endTime) => updateSchedule(schedule.weekday, { endTime })}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
