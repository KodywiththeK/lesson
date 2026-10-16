import { useState } from "react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  changeLessonFeeLessonType,
  createLessonFeeDraftFromInstrument,
  getLessonFeeSubmission,
  isReferralMonthMissing,
  repriceLessonFee,
} from "@/domain/lesson-fee-draft";
import {
  getStudentDisplayAge,
  type StudentListInstrument,
  type StudentListRow,
} from "@/domain/student-list";
import { getAcademyScheduleValidationError } from "@/domain/student-registration";
import type { TeacherListRow } from "@/domain/teacher-list";
import type { UpdateStudentProfileInput } from "@/lib/api/students";

import {
  contactRelationshipOptions,
  getTeacherCandidates,
  toWeekdayLabel,
  toWeekdayValue,
  weekdayOptions,
} from "./student-form-options";
import { StudentLessonFeeFields } from "./student-lesson-fee-fields";
import {
  WeeklyScheduleFields,
  type WeeklyScheduleDraft,
} from "./student-weekly-schedule-fields";

const MIN_PHONE_DIGITS = 4;
const SUNDAY = "sunday";

/** 원생 수정 폼. 등록 폼의 기본 정보·연락처와 대표 악기 설정을 수정한다(두 번째 이후 악기 편집은 지원하지 않는다). */
export function StudentEditForm({
  student,
  teachers,
  isSaving,
  onCancel,
  onSubmit,
}: {
  student: StudentListRow;
  teachers: TeacherListRow[];
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (input: UpdateStudentProfileInput) => Promise<void>;
}) {
  const primaryInstrument =
    student.instruments?.find((instrument) => instrument.active) ??
    student.instruments?.[0];
  const primaryContact = student.contacts?.[0];
  const instrumentId =
    primaryInstrument?.instrumentId || toInstrumentId(student.instrumentNames[0]);
  const instrumentName =
    primaryInstrument?.instrumentName ?? student.instrumentNames[0] ?? "";
  const displayAge = getStudentDisplayAge(student);
  const [name, setName] = useState(student.name);
  const [registeredOn, setRegisteredOn] = useState(student.registeredOn ?? "");
  const [age, setAge] = useState(displayAge === undefined ? "" : String(displayAge));
  const [grade, setGrade] = useState(student.grade ?? "");
  const [school, setSchool] = useState(student.school ?? "");
  const [occupation, setOccupation] = useState(student.occupation ?? "");
  const [contactRelationship, setContactRelationship] = useState(
    primaryContact?.relationship || "모",
  );
  const [contactPhone, setContactPhone] = useState(primaryContact?.phone ?? "");
  const [teacherId, setTeacherId] = useState(primaryInstrument?.teacherId ?? "");
  const [lessonType, setLessonType] = useState<"academy" | "private">(
    primaryInstrument?.lessonType === "private" ? "private" : "academy",
  );
  const [schedules, setSchedules] = useState(() =>
    toInitialSchedules(student, primaryInstrument),
  );
  // 이전 데이터에 일요일이 저장되어 있으면 수정 중에도 일요일 선택지를 유지한다.
  const [legacyWeekdays] = useState(() =>
    schedules.some((schedule) => schedule.weekday === SUNDAY) ? [SUNDAY] : [],
  );
  const [fee, setFee] = useState(() => createLessonFeeDraftFromInstrument(primaryInstrument));
  const referenceMonth = registeredOn.slice(0, 7);
  const feeContext = (
    nextLessonType: "academy" | "private",
    weekdayCount: number,
  ) => ({ instrumentName, lessonType: nextLessonType, weekdayCount });
  const teacherChoices = getEditTeacherChoices({
    instrumentName,
    teachers,
    currentTeacherId: primaryInstrument?.teacherId ?? undefined,
    currentTeacherName: primaryInstrument?.teacherName,
  });
  const selectedTeacher = teacherChoices.options.find(
    (teacher) => teacher.teacherId === teacherId,
  );
  const scheduleError = getAcademyScheduleValidationError({
    lessonType,
    teacherId,
    weeklySchedules: schedules,
  });
  const phoneError = getContactPhoneError(contactPhone, Boolean(primaryContact));
  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(registeredOn) &&
    !scheduleError &&
    !phoneError &&
    !isReferralMonthMissing(fee, referenceMonth);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        const weeklySchedules = sortWeeklySchedules(schedules).map((schedule) => ({
          weekdayLabel: toWeekdayLabel(schedule.weekday),
          startTime: schedule.startTime || undefined,
          endTime: schedule.endTime || undefined,
        }));
        const representativeSchedule = weeklySchedules.find(
          (schedule) => schedule.startTime && schedule.endTime,
        );
        const feeSubmission = getLessonFeeSubmission(fee, referenceMonth);

        // 저장 실패는 mutation이 안내하므로 폼은 열어 둔 채 다시 저장할 수 있게 한다.
        void onSubmit({
          academyId: student.academyId,
          studentId: student.studentId,
          name: name.trim(),
          studentInstrumentId: primaryInstrument?.studentInstrumentId,
          teacherId: selectedTeacher?.teacherId,
          teacherName: selectedTeacher?.name,
          instrumentId: instrumentId.trim(),
          instrumentName: instrumentName.trim(),
          lessonType,
          weekdayLabels: weeklySchedules.map((schedule) => schedule.weekdayLabel),
          startTime: representativeSchedule?.startTime ?? "",
          endTime: representativeSchedule?.endTime ?? "",
          weeklySchedules,
          progress: fee.progress,
          ...feeSubmission,
          basicInfo: {
            registeredOn,
            age: age ? Number(age) : undefined,
            grade,
            school,
            occupation,
            contactRelationship,
            contactPhone,
          },
        }).catch(() => undefined);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>원생명</span>
          <Input
            aria-label="원생명"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>등록일</span>
          <DateField aria-label="등록일" value={registeredOn} onValueChange={setRegisteredOn} />
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Label className="grid gap-1">
          <span>나이</span>
          <Input
            aria-label="나이"
            min={0}
            type="number"
            value={age}
            onChange={(event) => setAge(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>학년</span>
          <Input aria-label="학년" value={grade} onChange={(event) => setGrade(event.target.value)} />
        </Label>
        <Label className="grid gap-1">
          <span>학교</span>
          <Input aria-label="학교" value={school} onChange={(event) => setSchool(event.target.value)} />
        </Label>
        <Label className="grid gap-1">
          <span>직업</span>
          <Input
            aria-label="직업"
            value={occupation}
            onChange={(event) => setOccupation(event.target.value)}
          />
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Label className="grid gap-1">
          <span>연락처 구분</span>
          <NativeSelect
            aria-label="연락처 구분"
            value={contactRelationship}
            onChange={(event) => setContactRelationship(event.target.value)}
          >
            {getRelationshipChoices(contactRelationship).map((relationship) => (
              <NativeSelectOption key={relationship} value={relationship}>
                {relationship}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>연락처</span>
          <Input
            aria-label="연락처"
            aria-invalid={Boolean(phoneError)}
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="010-0000-0000"
          />
          {phoneError ? <span className="text-sm text-destructive">{phoneError}</span> : null}
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>담당 선생님</span>
          <NativeSelect
            aria-label="담당 선생님"
            value={teacherId}
            onChange={(event) => setTeacherId(event.target.value)}
          >
            <NativeSelectOption value="">미배정</NativeSelectOption>
            {teacherChoices.options.map((teacher) => (
              <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                {teacher.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {teacherChoices.isFallback ? (
            <span className="text-xs text-muted-foreground">
              {instrumentName} 파트 선생님이 없어 전체 선생님을 보여 줍니다.
            </span>
          ) : null}
        </Label>
        <Label className="grid gap-1">
          <span>악기</span>
          <Input
            aria-label="악기"
            readOnly
            value={instrumentName || "등록된 악기 없음"}
          />
        </Label>
      </div>

      <Label className="grid gap-1 sm:max-w-xs">
        <span>수업 형태</span>
        <NativeSelect
          aria-label="수업 형태"
          value={lessonType}
          onChange={(event) => {
            const nextLessonType = event.target.value as "academy" | "private";

            setLessonType(nextLessonType);
            setFee(
              changeLessonFeeLessonType(fee, feeContext(nextLessonType, schedules.length)),
            );
          }}
        >
          <NativeSelectOption value="academy">학원 수업</NativeSelectOption>
          <NativeSelectOption value="private">개인레슨</NativeSelectOption>
        </NativeSelect>
      </Label>

      <WeeklyScheduleFields
        legend="정기 요일"
        schedules={schedules}
        legacyWeekdays={legacyWeekdays}
        onChange={(nextSchedules) => {
          setSchedules(nextSchedules);
          setFee(repriceLessonFee(fee, feeContext(lessonType, nextSchedules.length)));
        }}
      />
      {scheduleError ? (
        <p className="text-sm text-destructive">{scheduleError}</p>
      ) : null}

      <StudentLessonFeeFields
        context={feeContext(lessonType, schedules.length)}
        referenceMonth={referenceMonth}
        draft={fee}
        onChange={setFee}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={!canSubmit || isSaving}>
          수정완료
        </Button>
      </DialogFooter>
    </form>
  );
}

function getContactPhoneError(phone: string, hasExistingContact: boolean) {
  const digits = phone.replace(/\D/g, "").length;

  if (!hasExistingContact && phone.trim() === "") {
    return null;
  }

  return digits >= MIN_PHONE_DIGITS ? null : "연락처는 숫자 4자리 이상 입력해 주세요.";
}

/** 저장된 관계가 기본 선택지에 없어도 그대로 보여 주고 유지한다. */
function getRelationshipChoices(current: string) {
  return contactRelationshipOptions.includes(current)
    ? contactRelationshipOptions
    : [...contactRelationshipOptions, current];
}

/** 저장된 요일별 시간을 폼 상태로 바꾼다. 요일별 행이 없는 이전 데이터는 대표 시간을 모든 요일에 쓴다. */
function toInitialSchedules(
  student: StudentListRow,
  instrument: StudentListInstrument | undefined,
): WeeklyScheduleDraft[] {
  const storedSchedules = instrument?.weeklySchedules ?? [];

  if (storedSchedules.length > 0) {
    return storedSchedules.map((schedule) => ({
      weekday: toWeekdayValue(schedule.weekdayLabel || schedule.weekday),
      startTime: schedule.startTime || undefined,
      endTime: schedule.endTime || undefined,
    }));
  }

  const labels = instrument?.weekdayLabels?.length
    ? instrument.weekdayLabels
    : student.weekdayLabels;

  return labels.map((label) => ({
    weekday: toWeekdayValue(label),
    startTime: instrument?.startTime || undefined,
    endTime: instrument?.endTime || undefined,
  }));
}

function sortWeeklySchedules(schedules: WeeklyScheduleDraft[]) {
  const order = (weekday: string) =>
    weekdayOptions.findIndex((option) => option.value === weekday);

  return [...schedules].sort((left, right) => order(left.weekday) - order(right.weekday));
}

/**
 * 수정 폼의 담당 선생님 후보. 악기 파트와 같은 선생님을 보여 주고(없으면 전체),
 * 이미 담당 중인 선생님이 휴직·퇴사로 목록에 없어도 선택지로 남겨 조용히 바뀌지 않게 한다.
 */
function getEditTeacherChoices({
  instrumentName,
  teachers,
  currentTeacherId,
  currentTeacherName,
}: {
  instrumentName: string;
  teachers: TeacherListRow[];
  currentTeacherId?: string;
  currentTeacherName?: string;
}) {
  const partTeachers = getTeacherCandidates(instrumentName, teachers);
  const isFallback = partTeachers.length === 0 && teachers.length > 0;
  const options = isFallback ? [...teachers] : [...partTeachers];

  if (currentTeacherId && !options.some((teacher) => teacher.teacherId === currentTeacherId)) {
    const currentTeacher = teachers.find((teacher) => teacher.teacherId === currentTeacherId);

    options.push(
      currentTeacher ??
        ({
          teacherId: currentTeacherId,
          name: currentTeacherName || "기존 담당 선생님",
        } as TeacherListRow),
    );
  }

  return { options, isFallback };
}

function toInstrumentId(value: string | undefined) {
  return value?.trim().toLocaleLowerCase("en-US").replace(/\s+/g, "-") ?? "";
}
