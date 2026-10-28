"use client";

import { useState } from "react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AcademyClosure } from "@/domain/academy-closure";
import { INSTRUMENT_COLOR_PRESETS, getDefaultInstrumentColor, getInstrumentColorStyle, resolveInstrumentColorPreset } from "@/domain/instrument-color";
import type { AcademyInstrumentColor, SaveAcademyClosureInput } from "@/lib/api/lesson-calendar-settings";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
type ClosureKind = "day" | "range" | "weekly";

export function LessonScheduleSettingsForm({
  instruments, colors, closures, isSaving,
  onSaveColor, onSaveClosure, onArchiveClosure,
}: {
  instruments: Array<{ id: string; name: string }>;
  colors: AcademyInstrumentColor[];
  closures: AcademyClosure[];
  isSaving: boolean;
  onSaveColor: (instrumentId: string, color: string) => void;
  onSaveClosure: (input: Omit<SaveAcademyClosureInput, "academyId">) => void;
  onArchiveClosure: (id: string) => void;
}) {
  const [closureId, setClosureId] = useState<string>();
  const [kind, setKind] = useState<ClosureKind>("day");
  const [title, setTitle] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [weekday, setWeekday] = useState(1);
  const resetClosureDraft = () => {
    setClosureId(undefined);
    setKind("day");
    setTitle("");
    setStartsOn("");
    setEndsOn("");
    setWeekday(1);
  };
  const canSaveClosure = Boolean(title.trim() && startsOn &&
    (kind === "day" || (endsOn && endsOn >= startsOn))) && !isSaving;

  return <div className="grid gap-4">
      <section className="grid gap-3 rounded-lg border p-3" aria-label="악기별 색상 설정">
        <h3 className="font-semibold">악기별 색상</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {instruments.map((instrument) => {
            const color = resolveInstrumentColorPreset(colors.find((item) => item.instrumentId === instrument.id)?.colorHex ?? getDefaultInstrumentColor(instrument.id));
            return <InstrumentColorPicker key={instrument.id} name={instrument.name} color={color} disabled={isSaving}
              onSelect={(next) => onSaveColor(instrument.id, next)} />;
          })}
        </div>
      </section>
      <section className="grid gap-3 rounded-lg border p-3" aria-label="휴원일 설정">
        <h3 className="font-semibold">휴원일</h3>
        {closureId ? <Button type="button" variant="outline" onClick={resetClosureDraft}>새 휴원일</Button> : null}
        <Label className="grid gap-1"><span>휴원 이름</span><Input aria-label="휴원 이름" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} /></Label>
        <Label className="grid gap-1"><span>휴원 종류</span>
          <NativeSelect aria-label="휴원 종류" value={kind} onChange={(event) => setKind(event.target.value as ClosureKind)}>
            <NativeSelectOption value="day">하루</NativeSelectOption>
            <NativeSelectOption value="range">연속 기간</NativeSelectOption>
            <NativeSelectOption value="weekly">매주 반복</NativeSelectOption>
          </NativeSelect>
        </Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="grid gap-1"><span>시작일</span><DateField aria-label="휴원 시작일" value={startsOn} onValueChange={setStartsOn} /></Label>
          {kind !== "day" ? <Label className="grid gap-1"><span>종료일</span>
            <DateField aria-label="휴원 종료일" value={endsOn} onValueChange={setEndsOn} /></Label> : null}
        </div>
        {kind === "weekly" ? <Label className="grid gap-1"><span>반복 요일</span>
          <NativeSelect aria-label="반복 요일" value={String(weekday)} onChange={(event) => setWeekday(Number(event.target.value))}>
            {WEEKDAYS.map((label, index) => <NativeSelectOption key={label} value={String(index)}>{label}요일</NativeSelectOption>)}
          </NativeSelect>
        </Label> : null}
        <Button type="button" disabled={!canSaveClosure} onClick={() => onSaveClosure({
          id: closureId, title, startsOn, endsOn: kind === "day" ? startsOn : endsOn || null,
          weekday: kind === "weekly" ? weekday : null,
        })}>{closureId ? "휴원일 수정" : "휴원일 지정"}</Button>
        <ul className="grid gap-2">
          {closures.filter((item) => item.active).map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
            <span>{item.title} · {item.startsOn}{item.endsOn && item.endsOn !== item.startsOn ? `~${item.endsOn}` : ""}{item.weekday !== null ? ` · 매주 ${WEEKDAYS[item.weekday]}요일` : ""}</span>
            <span className="flex gap-1"><Button type="button" variant="outline" size="sm" onClick={() => {
              setClosureId(item.id); setTitle(item.title); setStartsOn(item.startsOn);
              setEndsOn(item.endsOn ?? ""); setWeekday(item.weekday ?? 1);
              setKind(item.weekday !== null ? "weekly" : item.endsOn === item.startsOn ? "day" : "range");
            }}>수정</Button><Button type="button" variant="outline" size="sm" onClick={() => onArchiveClosure(item.id)}>해제</Button></span>
          </li>)}
        </ul>
      </section>
  </div>;
}

function InstrumentColorPicker({ name, color, disabled, onSelect }: {
  name: string; color: string; disabled: boolean; onSelect: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return <div className="grid gap-1 text-sm font-medium">
    <span>{name}</span>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button type="button" variant="outline" disabled={disabled} aria-label={`${name} 색상`} className="w-full justify-start">
        <span aria-hidden="true" className="size-6 rounded border" style={getInstrumentColorStyle(color, "scheduled")} />
        {`기본 색 ${INSTRUMENT_COLOR_PRESETS.indexOf(color as typeof INSTRUMENT_COLOR_PRESETS[number]) + 1}`}
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="grid w-48 grid-cols-4 gap-2">
        {INSTRUMENT_COLOR_PRESETS.map((preset, index) => <button key={preset} type="button"
          aria-label={`${name} 기본 색 ${index + 1}`} aria-pressed={color === preset}
          className="size-9 rounded-md border-2 border-border text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground"
          style={getInstrumentColorStyle(preset, "scheduled")} onClick={() => { setOpen(false); onSelect(preset); }}>{index + 1}</button>)}
      </PopoverContent>
    </Popover>
  </div>;
}
