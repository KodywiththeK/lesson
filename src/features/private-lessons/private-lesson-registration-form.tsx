"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ListStatusAlert } from "@/components/management/list-controls";
import {
  DateField,
  TimeField,
} from "@/components/operations/date-time-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { compareKoreanNames } from "@/domain/common-list";
import { getClosuresOnDate, type AcademyClosure } from "@/domain/academy-closure";
import {
  addMinutesToDateTime,
  filterTeachersForInstrument,
  findPrivateLessonConflictNotice,
  pickDefaultTeacherId,
  type PrivateLesson,
  type PrivateLessonTicketSearchBalance,
} from "@/domain/private-lesson";
import type {
  PrivateLessonRegistrationOptions,
  PrivateLessonAvailability,
  RegisterPrivateLessonEventInput,
} from "@/lib/api/private-lessons";
import { toUserMessage } from "@/lib/errors/user-message";
import { getTodayDate } from "@/features/lessons/workspace-helpers";

const MIN_LESSON_MINUTES = 5;
const MAX_LESSON_MINUTES = 240;

type RegistrationInstrument =
  PrivateLessonRegistrationOptions["students"][number]["instruments"][number];

export function PrivateLessonRegistrationForm({
  academyId,
  options,
  ticketBalances,
  fetchAvailability,
  closures = [],
  existingLessons = [],
  initialDate = "",
  isLoading,
  error,
  isSaving,
  onSubmit,
  onCancel,
}: {
  academyId: string;
  options: PrivateLessonRegistrationOptions;
  ticketBalances?: PrivateLessonTicketSearchBalance[];
  fetchAvailability?: (date: string) => Promise<PrivateLessonAvailability[]>;
  closures?: AcademyClosure[];
  /** 시간 겹침을 미리 알리는 데 쓰는 이미 등록된 개인레슨. 조회된 월의 일정만 담긴다. */
  existingLessons?: PrivateLesson[];
  initialDate?: string;
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
  onSubmit: (input: RegisterPrivateLessonEventInput) => void;
  onCancel: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [date, setDate] = useState(initialDate || getTodayDate());
  const [startTime, setStartTime] = useState("");
  const [minutesText, setMinutesText] = useState("");
  const [closureConfirmed, setClosureConfirmed] = useState(false);
  const matchingClosures = getClosuresOnDate(closures, date);
  const allStudents = useMemo(
    () =>
      [...options.students].sort((left, right) =>
        compareKoreanNames(left.studentName, right.studentName),
      ),
    [options.students],
  );
  const availabilityQuery = useQuery({
    queryKey: ["private-lesson-availability", academyId, date],
    queryFn: () => fetchAvailability?.(date) ?? Promise.resolve([]),
    enabled: Boolean(fetchAvailability && date),
  });
  const availability = fetchAvailability
    ? availabilityQuery.data ?? []
    : buildLocalAvailability(ticketBalances ?? [], existingLessons, academyId);
  const instruments = [...new Map(allStudents.flatMap((student) =>
    student.instruments.filter((instrument) => availability.some((row) =>
      row.studentId === student.studentId && row.instrumentId === instrument.instrumentId &&
      row.availableCount > 0,
    )).map((instrument) => [instrument.instrumentId, instrument.instrumentName] as const),
  )).entries()];
  const students = allStudents.filter((student) =>
    student.instruments.some((instrument) => instrument.instrumentId === instrumentId) &&
    availability.some((row) => row.studentId === student.studentId &&
      row.instrumentId === instrumentId && row.availableCount > 0),
  );
  const selectedStudent = students.find(
    (student) => student.studentId === studentId,
  );
  const selectedInstrument = selectedStudent?.instruments.find(
    (instrument) => instrument.instrumentId === instrumentId,
  );
  const teacherChoices = selectedInstrument
    ? filterTeachersForInstrument(
        selectedInstrument.instrumentName,
        options.teachers,
        selectedInstrument.teacherId,
      )
    : { teachers: options.teachers, isFallback: false };
  const selectedTeacher = options.teachers.find(
    (teacher) => teacher.teacherId === teacherId,
  );
  const selectedAvailability = availability.find((row) =>
    row.studentId === studentId && row.instrumentId === instrumentId);
  const lessonMinutes = parseLessonMinutes(minutesText);
  const startAt = date && startTime ? `${date}T${startTime}` : "";
  const endAt =
    startAt && lessonMinutes ? addMinutesToDateTime(startAt, lessonMinutes) : "";
  const conflictNotice =
    selectedStudent && selectedInstrument && selectedTeacher && startAt && endAt
      ? findPrivateLessonConflictNotice(existingLessons, {
          academyId,
          studentId: selectedStudent.studentId,
          instrumentId: selectedInstrument.instrumentId,
          teacherId: selectedTeacher.teacherId,
          startAt: toSeoulIsoOffset(startAt),
          endAt: toSeoulIsoOffset(endAt),
        })
      : undefined;
  const hasNoRegistrableStudent = !isLoading && !error && !availabilityQuery.isLoading && students.length === 0;
  const canSubmit =
    Boolean(selectedStudent) &&
    Boolean(selectedInstrument) &&
    Boolean(selectedTeacher) &&
    (selectedAvailability?.availableCount ?? 0) > 0 &&
    Boolean(startAt) &&
    Boolean(endAt) &&
    !conflictNotice &&
    (matchingClosures.length === 0 || closureConfirmed) &&
    !isSaving;

  /** 원생을 고르면 담당 선생님과 레슨 길이를 채운다. */
  function selectStudentInstrument(instrument: RegistrationInstrument | undefined) {
    setTeacherId(
      instrument ? pickDefaultTeacherId(instrument, options.teachers) : "",
    );
    setMinutesText(
      instrument
        ? String(instrument.lessonMinutes ?? "")
        : "",
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit || !selectedStudent || !selectedInstrument || !selectedTeacher) {
          return;
        }

        onSubmit({
          academyId,
          studentId: selectedStudent.studentId,
          studentName: selectedStudent.studentName,
          studentInstrumentId: selectedInstrument.studentInstrumentId,
          instrumentId: selectedInstrument.instrumentId,
          instrumentName: selectedInstrument.instrumentName,
          teacherId: selectedTeacher.teacherId,
          teacherName: selectedTeacher.teacherName,
          startAt: toSeoulIsoOffset(startAt),
          endAt: toSeoulIsoOffset(endAt),
        });
      }}
    >
      <ol className="grid gap-2 sm:grid-cols-5" aria-label="개인레슨 등록 단계">
        {["날짜", "악기", "원생", "선생님", "시간"].map((label) => (
          <li key={label}><Badge variant="outline">{label}</Badge></li>
        ))}
      </ol>

      {error ? (
        <ListStatusAlert
          message="개인레슨 등록 선택지를 불러오지 못했습니다."
          detail={toUserMessage(error)}
        />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          개인레슨 등록 선택지를 불러오는 중입니다.
        </p>
      ) : null}
      {availabilityQuery.isError ? (
        <ListStatusAlert message="예약 가능 회차를 불러오지 못했습니다." detail={toUserMessage(availabilityQuery.error)} />
      ) : null}
      {!isLoading && !error && !availabilityQuery.isLoading && !availabilityQuery.isError && instruments.length === 0 ? (
        <p role="status" className="text-sm text-destructive">
          선택한 날짜에 예약 가능한 회차권이 없습니다. 회차권 메뉴에서 등록해 주세요.
        </p>
      ) : null}

      <Label className="grid gap-1">
        <span>날짜</span>
        <DateField
          aria-label="날짜"
          value={date}
          onValueChange={(value) => {
            setDate(value);
            setClosureConfirmed(false);
            setInstrumentId("");
            setStudentId("");
            selectStudentInstrument(undefined);
          }}
        />
      </Label>
      {matchingClosures.length > 0 ? <div className="rounded-md border border-amber-500 p-2 text-sm">
        <p>휴원일: {matchingClosures.map((closure) => closure.title).join(", ")}</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={closureConfirmed} onChange={(event) => setClosureConfirmed(event.target.checked)} />휴원일 일정을 확인하고 등록</label>
      </div> : null}
      <Label className="grid gap-1">
        <span>악기</span>
        <NativeSelect
          aria-label="악기"
          value={instrumentId}
          disabled={!date || availabilityQuery.isLoading}
          onChange={(event) => {
            setInstrumentId(event.target.value);
            setStudentId("");
            selectStudentInstrument(undefined);
          }}
        >
          <NativeSelectOption value="">악기 선택</NativeSelectOption>
          {instruments.map(([id, name]) => (
            <NativeSelectOption key={id} value={id}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <Label className="grid gap-1">
        <span>원생</span>
        <NativeSelect
          aria-label="원생"
          value={studentId}
          disabled={!instrumentId || hasNoRegistrableStudent}
          onChange={(event) => {
            const nextStudent = students.find((student) => student.studentId === event.target.value);
            setStudentId(event.target.value);
            selectStudentInstrument(nextStudent?.instruments.find((instrument) => instrument.instrumentId === instrumentId));
          }}
        >
          <NativeSelectOption value="">{hasNoRegistrableStudent && instrumentId ? "예약 가능한 원생 없음" : "원생 선택"}</NativeSelectOption>
          {students.map((student) => (
            <NativeSelectOption key={student.studentId} value={student.studentId}>
              {student.studentName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {selectedAvailability ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            실제 잔여 {selectedAvailability.remainingCount}회 · 예약 {selectedAvailability.reservedCount}회 · 예약 가능 {selectedAvailability.availableCount}회
          </p>
        ) : null}
        {selectedInstrument?.sessionsPerMonth ? (
          <p className="text-xs text-muted-foreground">
            원생 등록 기준 월 {selectedInstrument.sessionsPerMonth}회
          </p>
        ) : null}
      </Label>

      <Label className="grid gap-1">
        <span>선생님</span>
        <NativeSelect
          aria-label="선생님"
          value={teacherId}
          disabled={!selectedInstrument}
          onChange={(event) => setTeacherId(event.target.value)}
        >
          <NativeSelectOption value="">선생님 선택</NativeSelectOption>
          {teacherChoices.teachers.map((teacher) => (
            <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
              {teacher.teacherName}
              {teacher.part ? ` / ${teacher.part}` : ""}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {teacherChoices.isFallback ? (
          <p className="text-xs text-muted-foreground">
            이 악기를 담당하는 선생님이 없어 전체 선생님을 보여 줍니다.
          </p>
        ) : null}
      </Label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>시작 시간</span>
          <TimeField
            aria-label="시작 시간"
            value={startTime}
            disabled={!selectedTeacher}
            onValueChange={setStartTime}
          />
        </Label>
        <Label className="grid gap-1">
          <span>레슨 시간(분)</span>
          <Input
            aria-label="레슨 시간(분)"
            type="number"
            inputMode="numeric"
            min={MIN_LESSON_MINUTES}
            max={MAX_LESSON_MINUTES}
            step={5}
            value={minutesText}
            aria-invalid={Boolean(selectedInstrument) && !lessonMinutes}
            disabled={!selectedInstrument}
            onChange={(event) => setMinutesText(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>종료 시간</span>
          <Input
            aria-label="종료 시간"
            readOnly
            value={formatEndLabel(date, endAt)}
            placeholder="자동 계산"
          />
        </Label>
      </div>

      {conflictNotice ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {conflictNotice}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isSaving ? "저장 중" : "완료"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function parseLessonMinutes(text: string) {
  const minutes = Number(text);

  return Number.isInteger(minutes) &&
    minutes >= MIN_LESSON_MINUTES &&
    minutes <= MAX_LESSON_MINUTES
    ? minutes
    : undefined;
}

/** 종료 시각을 `HH:mm`으로 보여 준다. 날짜가 넘어가면 날짜를 함께 적는다. */
function formatEndLabel(startDate: string, endAt: string) {
  if (!endAt) {
    return "";
  }

  const [endDate, endTime] = endAt.split("T");

  return endDate === startDate ? endTime : `${endDate} ${endTime}`;
}

function buildLocalAvailability(
  balances: PrivateLessonTicketSearchBalance[],
  lessons: PrivateLesson[],
  academyId: string,
): PrivateLessonAvailability[] {
  return balances.filter((balance) => balance.academyId === academyId).map((balance) => {
    const reservedCount = lessons.filter((lesson) =>
      lesson.academyId === academyId && lesson.studentId === balance.studentId &&
      lesson.instrumentId === balance.instrumentId && lesson.status === "scheduled").length;
    return {
      studentId: balance.studentId,
      instrumentId: balance.instrumentId,
      remainingCount: balance.remainingCount,
      reservedCount,
      availableCount: Math.max(0, balance.remainingCount - reservedCount),
    };
  });
}

function toSeoulIsoOffset(value: string) {
  return `${value}:00+09:00`;
}
