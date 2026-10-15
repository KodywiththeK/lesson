"use client";

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
import {
  DEFAULT_PRIVATE_LESSON_MINUTES,
  addMinutesToDateTime,
  filterTeachersForInstrument,
  findPrivateLessonConflictNotice,
  getPrivateLessonRegistrationFlowState,
  pickDefaultTeacherId,
  type PrivateLesson,
  type PrivateLessonTicketSearchBalance,
} from "@/domain/private-lesson";
import type {
  PrivateLessonRegistrationOptions,
  RegisterPrivateLessonEventInput,
} from "@/lib/api/private-lessons";
import { toUserMessage } from "@/lib/errors/user-message";

const MIN_LESSON_MINUTES = 5;
const MAX_LESSON_MINUTES = 240;

type RegistrationInstrument =
  PrivateLessonRegistrationOptions["students"][number]["instruments"][number];

export function PrivateLessonRegistrationForm({
  academyId,
  options,
  ticketBalances,
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
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("");
  const [minutesText, setMinutesText] = useState("");
  const students = useMemo(
    () =>
      [...options.students].sort((left, right) =>
        compareKoreanNames(left.studentName, right.studentName),
      ),
    [options.students],
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
  const selectedTicketBalance =
    selectedStudent && selectedInstrument && ticketBalances
      ? findTicketBalance(ticketBalances, {
          academyId,
          studentId: selectedStudent.studentId,
          instrumentId: selectedInstrument.instrumentId,
        })
      : undefined;
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
  const flow = getPrivateLessonRegistrationFlowState({
    academyId,
    studentId: studentId || undefined,
    instrumentId: instrumentId || undefined,
    teacherId: teacherId || undefined,
    startAt: startAt || undefined,
    endAt: endAt || undefined,
  });
  const hasNoRegistrableStudent = !isLoading && !error && students.length === 0;
  const canSubmit =
    Boolean(selectedStudent) &&
    Boolean(selectedInstrument) &&
    Boolean(selectedTeacher) &&
    Boolean(startAt) &&
    Boolean(endAt) &&
    !conflictNotice &&
    !isSaving;

  /** 악기를 고르면 그 악기의 담당(또는 같은 파트) 선생님과 원생의 레슨 길이를 기본값으로 채운다. */
  function selectInstrument(instrument: RegistrationInstrument | undefined) {
    setInstrumentId(instrument?.instrumentId ?? "");
    setTeacherId(
      instrument ? pickDefaultTeacherId(instrument, options.teachers) : "",
    );
    setMinutesText(
      instrument
        ? String(instrument.lessonMinutes ?? DEFAULT_PRIVATE_LESSON_MINUTES)
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
      <ol className="grid gap-2 sm:grid-cols-4" aria-label="개인레슨 등록 단계">
        {flow.steps.map((step) => (
          <li key={step.id}>
            <Badge variant={step.status === "locked" ? "secondary" : "outline"}>
              {step.label}
            </Badge>
          </li>
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

      <Label className="grid gap-1">
        <span>원생</span>
        <NativeSelect
          aria-label="원생"
          value={studentId}
          disabled={hasNoRegistrableStudent}
          onChange={(event) => {
            const nextStudentId = event.target.value;
            const nextStudent = students.find(
              (student) => student.studentId === nextStudentId,
            );

            // 악기가 하나뿐일 때만 자동 선택한다. 여러 개면 직접 고르게 한다.
            const onlyInstrument =
              nextStudent?.instruments.length === 1 ? nextStudent.instruments[0] : undefined;

            setStudentId(nextStudentId);
            selectInstrument(onlyInstrument);
          }}
        >
          <NativeSelectOption value="">
            {hasNoRegistrableStudent ? "등록된 원생 없음" : "원생 선택"}
          </NativeSelectOption>
          {students.map((student) => (
            <NativeSelectOption key={student.studentId} value={student.studentId}>
              {formatStudentOptionLabel(student, ticketBalances, academyId)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>

      <Label className="grid gap-1">
        <span>악기</span>
        <NativeSelect
          aria-label="악기"
          value={instrumentId}
          disabled={!selectedStudent}
          onChange={(event) =>
            selectInstrument(
              selectedStudent?.instruments.find(
                (instrument) => instrument.instrumentId === event.target.value,
              ),
            )
          }
        >
          <NativeSelectOption value="">악기 선택</NativeSelectOption>
          {(selectedStudent?.instruments ?? []).map((instrument) => (
            <NativeSelectOption
              key={instrument.instrumentId}
              value={instrument.instrumentId}
            >
              {instrument.instrumentName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {ticketBalances && selectedInstrument ? (
          <TicketBalanceNotice remainingCount={selectedTicketBalance?.remainingCount} />
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
          <span>날짜</span>
          <DateField
            aria-label="날짜"
            value={date}
            disabled={!selectedTeacher}
            onValueChange={setDate}
          />
        </Label>
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

function TicketBalanceNotice({ remainingCount }: { remainingCount: number | undefined }) {
  if (!remainingCount) {
    return (
      <p className="text-xs font-medium text-destructive" role="status">
        사용할 수 있는 회차권이 없습니다. 일정은 등록할 수 있지만, 출석 확인 전에 회차권 메뉴에서 먼저
        등록해 주세요.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      선택 악기 잔여 회차권 {remainingCount}회
    </p>
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

function formatStudentOptionLabel(
  student: PrivateLessonRegistrationOptions["students"][number],
  ticketBalances: PrivateLessonTicketSearchBalance[] | undefined,
  academyId: string,
) {
  if (!ticketBalances) {
    return student.studentName;
  }

  const summaries = student.instruments.flatMap((instrument) => {
    const ticketBalance = findTicketBalance(ticketBalances, {
      academyId,
      studentId: student.studentId,
      instrumentId: instrument.instrumentId,
    });

    return ticketBalance
      ? [`${ticketBalance.instrumentName} ${ticketBalance.remainingCount}회`]
      : [];
  });

  return `${student.studentName} · ${
    summaries.length > 0 ? summaries.join(", ") : "회차권 없음"
  }`;
}

function findTicketBalance(
  ticketBalances: PrivateLessonTicketSearchBalance[],
  input: {
    academyId: string;
    studentId: string;
    instrumentId: string;
  },
) {
  return ticketBalances.find(
    (ticket) =>
      ticket.academyId === input.academyId &&
      ticket.studentId === input.studentId &&
      ticket.instrumentId === input.instrumentId,
  );
}

function toSeoulIsoOffset(value: string) {
  return `${value}:00+09:00`;
}
