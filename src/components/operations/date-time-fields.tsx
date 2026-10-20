"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { format, isValid, parse } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getFinanceToday } from "@/domain/finance-date";
import { cn } from "@/lib/utils";

type FieldProps = {
  "aria-label": string;
  value: string;
  onValueChange: (value: string) => void;
  /** 버튼형 제출 화면은 아직 확정되지 않은 입력 초안도 검증할 수 있다. */
  onValidityChange?: (valid: boolean) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  /** 이 값 이후는 고르거나 입력할 수 없다(저장 형식 문자열 비교). 현재는 월 필드의 선택 패널이 반영한다. */
  max?: string;
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

function normalizeTimeInput(value: string): string | null {
  const match = /^(\d{1,2})(?::(\d{0,2}))?$/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2] || "0");
  if (hour > 23 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeIncompleteTime(kind: FieldKind, value: string): string | null {
  if (kind === "time") return normalizeTimeInput(value);
  if (kind !== "dateTime") return null;

  const [date, time, extra] = value.split("T");
  const normalizedTime = extra === undefined && isValidDate(date) ? normalizeTimeInput(time) : null;
  return normalizedTime ? `${date}T${normalizedTime}` : null;
}

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
 * 입력 중인 글자는 필드가 들고 있다가 완성된 유효 값(또는 필수가 아닌 필드의 빈 값)일 때만
 * `onValueChange`로 올린다. 화면 state에는 `2026-1` 같은 미완성 문자열이 들어오지 않는다.
 */
function PickerField({
  kind,
  panel,
  value,
  onValueChange,
  onValidityChange,
  className,
  disabled,
  id,
  required,
  max,
  "aria-label": label,
}: FieldProps & { kind: FieldKind; panel: (api: PickerApi) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [showError, setShowError] = useState(false);
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { icon: Icon, triggerName, placeholder, invalidMessage, isValid: isValidKind } = FIELD_KINDS[kind];
  // max는 월 필드만 반영한다. 날짜·시간 문자열과 비교하면 형식이 달라 잘못 막힌다.
  const monthMax = kind === "month" ? max : undefined;
  const isValidValue = (candidate: string) => isValidKind(candidate) && (!monthMax || candidate <= monthMax);
  const invalid = text !== "" && !isValidValue(text);
  const isDraftValid = text === "" ? !required : !invalid;

  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? invalidMessage : "");
  }, [invalid, invalidMessage]);

  useEffect(() => {
    onValidityChange?.(isDraftValid);
  }, [isDraftValid, onValidityChange]);

  function commit(next: string) {
    setText(next);
    setShowError(false);
    onValueChange(next);
  }

  function handleTextChange(next: string) {
    setText(next);
    if (showError) setShowError(next === "" ? Boolean(required) : !isValidValue(next));
    // 필수 필드는 비운 값을 올리지 않는다. 화면 state가 빈 값이 되어 조회·계산이 깨지는 것을 막는다.
    const canCommit = next === "" ? !required : isValidValue(next);
    if (canCommit) onValueChange(next);
  }

  function validateDraft() {
    const normalized = normalizeIncompleteTime(kind, text);
    if (normalized && isValidValue(normalized)) {
      commit(normalized);
      return true;
    }

    const hasError = text === "" ? Boolean(required) : !isValidValue(text);
    setShowError(hasError);
    return !hasError;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("flex min-w-0 items-center gap-1", className)}>
        <Input
          ref={inputRef}
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={showError ? errorId : undefined}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          disabled={disabled}
          required={required}
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={validateDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (!isValidValue(text) || text === "")) {
              event.preventDefault();
              validateDraft();
            }
          }}
          className="min-w-0 flex-1 tabular-nums"
        />
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" disabled={disabled} aria-label={`${label} ${triggerName} 열기`}>
            <Icon aria-hidden="true" />
          </Button>
        </PopoverTrigger>
      </div>
      {showError ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {text === "" ? `${label}을(를) 입력해 주세요.` : invalidMessage}
        </p>
      ) : null}
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
      <NativeSelect aria-label="시" value={hour} onChange={(event) => onChange(minute ? { hour: event.target.value } : { hour: event.target.value, minute: "00" })}>
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

function MonthPanel({
  value,
  max,
  onSelect,
}: {
  value: string;
  max?: string;
  onSelect: (month: string) => void;
}) {
  const match = MONTH_PATTERN.exec(value);
  const selectedYear = match ? Number(match[1]) : undefined;
  const selectedMonth = match?.[2];
  const baseYear = selectedYear ?? Number(getFinanceToday().slice(0, 4));
  const [year, setYear] = useState(baseYear);
  const maxYear = max ? Number(max.slice(0, 4)) : undefined;
  const years = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, index) => baseYear - YEAR_RANGE + index).filter(
    (item) => maxYear === undefined || item <= maxYear,
  );

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
              disabled={Boolean(max) && `${year}-${month}` > (max ?? "")}
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
          max={props.max}
          onSelect={(month) => {
            commit(month);
            close();
          }}
        />
      )}
    />
  );
}
