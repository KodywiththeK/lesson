"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { format, isValid, parse } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FieldProps = {
  "aria-label": string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
};

const DATE_FORMAT = "yyyy-MM-dd";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));
const MONTHS = Array.from({ length: 12 }, (_, month) => String(month + 1).padStart(2, "0"));
const YEAR_RANGE = 20;
// 이 프로젝트의 Dialog 내용(z-[60])보다 위에 떠야 다이얼로그 안에서 선택기를 누를 수 있다.
const PICKER_CONTENT_CLASS_NAME = "z-[70] w-auto max-w-[calc(100vw-2rem)] p-0";
const CALENDAR_START_MONTH = new Date(1900, 0);
const CALENDAR_END_MONTH = new Date(2100, 11);

function parseDate(value: string): Date | undefined {
  if (!DATE_PATTERN.test(value)) return undefined;
  const date = parse(value, DATE_FORMAT, new Date());
  return isValid(date) ? date : undefined;
}

function isValidDate(value: string) {
  return parseDate(value) !== undefined;
}

function isValidTime(value: string) {
  return TIME_PATTERN.test(value);
}

function isValidMonth(value: string) {
  return MONTH_PATTERN.test(value);
}

function isValidDateTime(value: string) {
  const [date = "", time = ""] = value.split("T");
  return value.includes("T") && isValidDate(date) && isValidTime(time);
}

function splitTime(value: string) {
  const match = TIME_PATTERN.exec(value);
  return { hour: match?.[1] ?? "", minute: match?.[2] ?? "" };
}

function splitDateTime(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date: isValidDate(date) ? date : "", ...splitTime(time) };
}

type FieldKind = "date" | "time" | "month" | "dateTime";

const FIELD_KINDS: Record<
  FieldKind,
  {
    icon: typeof CalendarDays;
    triggerName: string;
    placeholder: string;
    invalidMessage: string;
    isValid: (value: string) => boolean;
  }
> = {
  date: {
    icon: CalendarDays,
    triggerName: "달력",
    placeholder: "YYYY-MM-DD",
    invalidMessage: "YYYY-MM-DD 형식의 실제 날짜를 입력하세요.",
    isValid: isValidDate,
  },
  time: {
    icon: Clock3,
    triggerName: "시간 선택",
    placeholder: "HH:mm",
    invalidMessage: "00:00부터 23:59 사이의 HH:mm 형식으로 입력하세요.",
    isValid: isValidTime,
  },
  month: {
    icon: CalendarDays,
    triggerName: "월 선택",
    placeholder: "YYYY-MM",
    invalidMessage: "YYYY-MM 형식의 실제 월을 입력하세요.",
    isValid: isValidMonth,
  },
  dateTime: {
    icon: CalendarDays,
    triggerName: "달력",
    placeholder: "YYYY-MM-DDTHH:mm",
    invalidMessage: "YYYY-MM-DDTHH:mm 형식의 실제 일시를 입력하세요.",
    isValid: isValidDateTime,
  },
};

/**
 * 선택기에서 고른 부분 값을 모아 두었다가 모든 부분이 채워졌을 때만 확정한다.
 * 패널은 열릴 때마다 새로 마운트되므로 닫으면 고르다 만 값은 버려진다.
 */
function useDraftParts<Key extends string>(
  committed: Record<Key, string>,
  commit: (parts: Record<Key, string>) => void,
) {
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({});
  const parts = { ...committed, ...draft };

  function update(patch: Partial<Record<Key, string>>) {
    const next = { ...parts, ...patch };
    if (Object.values(next).every(Boolean)) {
      setDraft({});
      commit(next);
      return;
    }
    setDraft(next);
  }

  return [parts, update] as const;
}

type PickerApi = {
  /** 선택기에서 확정한 값을 입력과 부모에 함께 반영한다. */
  commit: (value: string) => void;
  close: () => void;
};

/**
 * 입력 중인 글자는 필드가 들고 있다가 완성된 유효 값(또는 빈 값)일 때만 `onValueChange`로 올린다.
 * 화면 state에는 `2026-1` 같은 미완성 문자열이 들어오지 않는다.
 */
function PickerField({
  kind,
  panel,
  value,
  onValueChange,
  className,
  disabled,
  id,
  required,
  "aria-label": label,
}: FieldProps & { kind: FieldKind; panel: (api: PickerApi) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const { icon: Icon, triggerName, placeholder, invalidMessage, isValid: isValidValue } = FIELD_KINDS[kind];
  const invalid = text !== "" && !isValidValue(text);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? invalidMessage : "");
  }, [invalid, invalidMessage]);

  function commit(next: string) {
    setText(next);
    onValueChange(next);
  }

  function handleTextChange(next: string) {
    setText(next);
    if (next === "" || isValidValue(next)) onValueChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("flex min-w-0 items-center gap-1", className)}>
        <Input
          ref={inputRef}
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          disabled={disabled}
          required={required}
          onChange={(event) => handleTextChange(event.target.value)}
          className="min-w-0 flex-1 tabular-nums"
        />
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" disabled={disabled} aria-label={`${label} ${triggerName} 열기`}>
            <Icon aria-hidden="true" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className={PICKER_CONTENT_CLASS_NAME}>
        {panel({ commit, close: () => setOpen(false) })}
      </PopoverContent>
    </Popover>
  );
}

function DateCalendar({ selected, onSelect }: { selected: string; onSelect: (date: string) => void }) {
  const selectedDate = parseDate(selected);
  return (
    <Calendar
      mode="single"
      required
      selected={selectedDate}
      defaultMonth={selectedDate}
      captionLayout="dropdown"
      startMonth={CALENDAR_START_MONTH}
      endMonth={CALENDAR_END_MONTH}
      locale={ko}
      formatters={{ formatMonthDropdown: (date) => format(date, "M월", { locale: ko }) }}
      onSelect={(date) => onSelect(format(date, DATE_FORMAT))}
    />
  );
}

function TimeSelects({
  hour,
  minute,
  onChange,
}: {
  hour: string;
  minute: string;
  onChange: (patch: { hour?: string; minute?: string }) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3">
      <NativeSelect aria-label="시" value={hour} onChange={(event) => onChange({ hour: event.target.value })}>
        <NativeSelectOption value="" disabled>--</NativeSelectOption>
        {HOURS.map((item) => <NativeSelectOption key={item} value={item}>{item}시</NativeSelectOption>)}
      </NativeSelect>
      <span aria-hidden="true">:</span>
      <NativeSelect aria-label="분" value={minute} onChange={(event) => onChange({ minute: event.target.value })}>
        <NativeSelectOption value="" disabled>--</NativeSelectOption>
        {MINUTES.map((item) => <NativeSelectOption key={item} value={item}>{item}분</NativeSelectOption>)}
      </NativeSelect>
    </div>
  );
}

function TimePanel({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  const [parts, update] = useDraftParts(splitTime(value), ({ hour, minute }) => onValueChange(`${hour}:${minute}`));
  return <TimeSelects hour={parts.hour} minute={parts.minute} onChange={update} />;
}

function DateTimePanel({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  const [parts, update] = useDraftParts(splitDateTime(value), ({ date, hour, minute }) =>
    onValueChange(`${date}T${hour}:${minute}`),
  );
  return (
    <>
      <DateCalendar selected={parts.date} onSelect={(date) => update({ date })} />
      <div className="border-t">
        <TimeSelects hour={parts.hour} minute={parts.minute} onChange={update} />
      </div>
    </>
  );
}

function MonthPanel({ value, onSelect }: { value: string; onSelect: (month: string) => void }) {
  const match = MONTH_PATTERN.exec(value);
  const selectedYear = match ? Number(match[1]) : undefined;
  const selectedMonth = match?.[2];
  const baseYear = selectedYear ?? new Date().getFullYear();
  const [year, setYear] = useState(baseYear);
  const years = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, index) => baseYear - YEAR_RANGE + index);

  return (
    <div className="w-64 max-w-full p-3">
      <NativeSelect aria-label="연도" value={String(year)} onChange={(event) => setYear(Number(event.target.value))}>
        {years.map((item) => <NativeSelectOption key={item} value={String(item)}>{item}년</NativeSelectOption>)}
      </NativeSelect>
      <div className="mt-3 grid grid-cols-3 gap-1">
        {MONTHS.map((month) => {
          const isSelected = year === selectedYear && month === selectedMonth;
          return (
            <Button
              key={month}
              type="button"
              variant={isSelected ? "secondary" : "ghost"}
              aria-label={`${Number(month)}월`}
              aria-pressed={isSelected}
              onClick={() => onSelect(`${year}-${month}`)}
            >
              {Number(month)}월
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function DateField(props: FieldProps) {
  return (
    <PickerField
      {...props}
      kind="date"
      panel={({ commit, close }) => (
        <DateCalendar
          selected={props.value}
          onSelect={(date) => {
            commit(date);
            close();
          }}
        />
      )}
    />
  );
}

export function TimeField(props: FieldProps) {
  return (
    <PickerField
      {...props}
      kind="time"
      panel={({ commit }) => <TimePanel value={props.value} onValueChange={commit} />}
    />
  );
}

export function DateTimeField(props: FieldProps) {
  return (
    <PickerField
      {...props}
      kind="dateTime"
      panel={({ commit }) => <DateTimePanel value={props.value} onValueChange={commit} />}
    />
  );
}

export function MonthField(props: FieldProps) {
  return (
    <PickerField
      {...props}
      kind="month"
      panel={({ commit, close }) => (
        <MonthPanel
          value={props.value}
          onSelect={(month) => {
            commit(month);
            close();
          }}
        />
      )}
    />
  );
}
