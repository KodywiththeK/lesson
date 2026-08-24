"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Eye, Pencil, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ListView } from "@/domain/common-list";
import type {
  BuildStudentListOptions,
  StudentListRow,
} from "@/domain/student-list";
import {
  createStudentListQueryOptions,
  registerStudentEnrollment,
  updateStudentProfile,
  type RegisterStudentEnrollmentInput,
  type StudentRegistrationSupabaseClient,
  type StudentListSupabaseClient,
  type StudentUpdateSupabaseClient,
  type UpdateStudentProfileInput,
} from "@/lib/api/students";
import {
  createTeacherListQueryOptions,
  type TeacherListSupabaseClient,
} from "@/lib/api/teachers";
import { queryKeys } from "@/lib/api/query-keys";
import type { DemoStudentRegistrationInput } from "@/lib/demo/academy-demo-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TeacherListRow } from "@/domain/teacher-list";

type StudentListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<StudentListRow>>;
};

export type StudentListQueryOptionsFactory = (
  options: BuildStudentListOptions,
) => StudentListQueryOptions;

type StudentListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: StudentListQueryOptionsFactory;
  teachers?: TeacherListRow[];
  registerStudent?: (input: DemoStudentRegistrationInput) => void | Promise<void>;
  updateStudent?: (input: UpdateStudentProfileInput) => void | Promise<void>;
};

type StudentSupabaseClient = StudentListSupabaseClient &
  StudentRegistrationSupabaseClient &
  StudentUpdateSupabaseClient &
  TeacherListSupabaseClient;

type SupabaseClientState =
  | {
      client: StudentSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

export function StudentListScreen({
  academyId,
  academyName,
  queryOptionsFactory,
  teachers = [],
  registerStudent,
  updateStudent,
}: StudentListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [weekdayLabel, setWeekdayLabel] = useState("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentListRow | null>(
    null,
  );
  const [studentOverrides, setStudentOverrides] = useState<
    Record<string, StudentListRow>
  >({});
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createStudentListSupabaseClient()),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildStudentListOptions = {
    academyId,
    search,
    filters: {
      teacherName: teacherName || undefined,
      instrumentName: instrumentName || undefined,
      weekdayLabel: weekdayLabel || undefined,
    },
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const studentListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const teacherOptionsQuery = useQuery({
    ...createDefaultTeacherOptionsQueryOptions(
      academyId,
      supabaseClientState ?? createMissingSupabaseClientState(),
    ),
    enabled: !teachers.length && !supabaseClientState?.error,
  });
  const teacherOptions = teachers.length
    ? teachers
    : teacherOptionsQuery.data?.items ?? [];
  const registerMutation = useMutation({
    mutationFn: async (input: DemoStudentRegistrationInput) => {
      if (registerStudent) {
        await registerStudent(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await registerStudentEnrollment(supabaseClientState.client, {
        academyId,
        name: input.name,
        registeredAt: input.registeredAt,
        teacherId: input.teacherId ?? "",
        teacherName: input.teacherName ?? "",
        lessonType: input.lessonType,
        weekdays: input.weekdays,
        instrumentId: input.instrumentId,
        instrumentName: input.instrumentName,
        startTime: input.startTime ?? "14:00",
        endTime: input.endTime ?? "14:50",
        progress: input.progress,
        lessonFee: input.lessonFee,
        discountTotal: input.discountTotal,
        finalMonthlyFee: input.finalMonthlyFee,
      } satisfies RegisterStudentEnrollmentInput);
    },
    onSuccess: () => {
      setIsRegistrationOpen(false);
      toast.success("원생을 등록했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "students"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "lesson-workspace"],
      });
    },
    onError: (error) => {
      toast.error("원생 등록에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (input: UpdateStudentProfileInput) => {
      if (updateStudent) {
        await updateStudent(input);
        return applyStudentUpdate(selectedStudent, input);
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return updateStudentProfile(supabaseClientState.client, input);
    },
    onSuccess: (updatedStudent) => {
      const mergedStudent = mergeStudentRow(
        studentOverrides[updatedStudent.studentId] ?? selectedStudent,
        updatedStudent,
      );

      setStudentOverrides((current) => ({
        ...current,
        [updatedStudent.studentId]: mergedStudent,
      }));
      setSelectedStudent(mergedStudent);
      toast.success("원생 정보를 수정했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "students"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "lesson-workspace"],
      });
    },
    onError: (error) => {
      toast.error("원생 정보 수정에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const queriedStudents = studentListQuery.data?.items ?? [];
  const students = queriedStudents.map(
    (student) => studentOverrides[student.studentId] ?? student,
  );
  const filterOptions = buildFilterOptions(students);

  return (
    <section className="grid gap-4" aria-labelledby="student-list-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="student-list-heading" className="text-2xl font-semibold">
            원생 목록
          </h2>
        </div>
        <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
          <DialogTrigger asChild>
            <Button type="button">
              <UserPlus aria-hidden="true" />
              원생 등록
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>원생 등록</DialogTitle>
              <DialogDescription>
                원생의 수강 악기와 레슨 기준을 함께 등록합니다.
              </DialogDescription>
            </DialogHeader>
            <StudentRegistrationForm
              teachers={teacherOptions}
              onSubmit={(input) => {
                registerMutation.mutate(input);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_repeat(3,11rem)_auto]">
          <ListSearchField
            label="원생 검색"
            value={search}
            onChange={setSearch}
            placeholder="이름, 선생님, 악기, 요일"
          />

          <ListFilterSelect
            label="선생님 필터"
            value={teacherName}
            options={filterOptions.teacherNames}
            onChange={setTeacherName}
          />
          <ListFilterSelect
            label="악기 필터"
            value={instrumentName}
            options={filterOptions.instrumentNames}
            onChange={setInstrumentName}
          />
          <ListFilterSelect
            label="요일 필터"
            value={weekdayLabel}
            options={filterOptions.weekdayLabels}
            onChange={setWeekdayLabel}
          />

          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setTeacherName("");
              setInstrumentName("");
              setWeekdayLabel("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 원생 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {studentListQuery.isError ? (
          <ListStatusAlert
            message="원생 목록을 불러오지 못했습니다."
            detail={studentListQuery.error.message}
          />
        ) : null}

        {studentListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            원생 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!studentListQuery.isLoading &&
        !studentListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <StudentListTable
            students={students}
            onOpenStudent={setSelectedStudent}
          />
        ) : null}
      </div>

      <StudentDetailDialog
        student={selectedStudent}
        teachers={teacherOptions}
        isSaving={updateMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null);
          }
        }}
        onSubmit={(input) => updateMutation.mutateAsync(input)}
      />
    </section>
  );
}

function StudentRegistrationForm({
  teachers,
  onSubmit,
}: {
  teachers: TeacherListRow[];
  onSubmit: (input: DemoStudentRegistrationInput) => void;
}) {
  const firstTeacher = teachers[0];
  const [name, setName] = useState("");
  const [registeredAt, setRegisteredAt] = useState("2026-08-21");
  const [teacherId, setTeacherId] = useState(firstTeacher?.teacherId ?? "");
  const [lessonType, setLessonType] = useState<"academy" | "private">("academy");
  const [instrumentId, setInstrumentId] = useState("piano");
  const [instrumentName, setInstrumentName] = useState("피아노");
  const [weekday, setWeekday] = useState("friday");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("14:50");
  const [lessonFee, setLessonFee] = useState(150000);
  const [discountTotal, setDiscountTotal] = useState(0);
  const selectedTeacher =
    teachers.find((teacher) => teacher.teacherId === teacherId) ?? firstTeacher;
  const finalMonthlyFee = Math.max(0, lessonFee - discountTotal);
  const canSubmit = Boolean(name.trim() && selectedTeacher);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!selectedTeacher || !canSubmit) {
          return;
        }

        onSubmit({
          name: name.trim(),
          registeredAt,
          instrumentId,
          instrumentName,
          teacherId: selectedTeacher.teacherId,
          teacherName: selectedTeacher.name,
          lessonType,
          weekdays: [weekday as DemoStudentRegistrationInput["weekdays"][number]],
          startTime,
          endTime,
          progress: "신규 등록",
          lessonFee,
          discountTotal,
          finalMonthlyFee,
        });
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
          <Input
            aria-label="등록일"
            type="date"
            value={registeredAt}
            onChange={(event) => setRegisteredAt(event.target.value)}
          />
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
            {teachers.map((teacher) => (
              <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                {teacher.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>수업 형태</span>
          <NativeSelect
            aria-label="수업 형태"
            value={lessonType}
            onChange={(event) =>
              setLessonType(event.target.value as "academy" | "private")
            }
          >
            <NativeSelectOption value="academy">학원 수업</NativeSelectOption>
            <NativeSelectOption value="private">개인레슨</NativeSelectOption>
          </NativeSelect>
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Label className="grid gap-1">
          <span>악기 ID</span>
          <Input
            aria-label="악기 ID"
            value={instrumentId}
            onChange={(event) => setInstrumentId(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>악기명</span>
          <Input
            aria-label="악기명"
            value={instrumentName}
            onChange={(event) => setInstrumentName(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>요일</span>
          <NativeSelect
            aria-label="요일"
            value={weekday}
            onChange={(event) => setWeekday(event.target.value)}
          >
            <NativeSelectOption value="monday">월</NativeSelectOption>
            <NativeSelectOption value="tuesday">화</NativeSelectOption>
            <NativeSelectOption value="wednesday">수</NativeSelectOption>
            <NativeSelectOption value="thursday">목</NativeSelectOption>
            <NativeSelectOption value="friday">금</NativeSelectOption>
            <NativeSelectOption value="saturday">토</NativeSelectOption>
            <NativeSelectOption value="sunday">일</NativeSelectOption>
          </NativeSelect>
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>시작 시간</span>
          <Input
            aria-label="시작 시간"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>종료 시간</span>
          <Input
            aria-label="종료 시간"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Label className="grid gap-1">
          <span>레슨비</span>
          <Input
            aria-label="레슨비"
            type="number"
            value={lessonFee}
            onChange={(event) => setLessonFee(Number(event.target.value))}
          />
        </Label>
        <Label className="grid gap-1">
          <span>할인</span>
          <Input
            aria-label="할인"
            type="number"
            value={discountTotal}
            onChange={(event) => setDiscountTotal(Number(event.target.value))}
          />
        </Label>
        <Label className="grid gap-1">
          <span>최종 수강료</span>
          <Input aria-label="최종 수강료" readOnly value={finalMonthlyFee} />
        </Label>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}

function StudentDetailDialog({
  student,
  teachers,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  student: StudentListRow | null;
  teachers: TeacherListRow[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: UpdateStudentProfileInput) => Promise<StudentListRow>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const primaryInstrument = student?.instruments?.find((instrument) => instrument.active) ??
    student?.instruments?.[0];

  return (
    <Dialog
      open={Boolean(student)}
      onOpenChange={(open) => {
        if (!open) {
          setIsEditing(false);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {student ? `${student.name} 원생 상세` : "원생 상세"}
          </DialogTitle>
          <DialogDescription>
            원생의 기본 정보와 대표 수업 정보를 확인하고 수정합니다.
          </DialogDescription>
        </DialogHeader>

        {student && !isEditing ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-md border border-border bg-background p-4 sm:grid-cols-2">
              <DetailItem label="원생명" value={student.name} />
              <DetailItem label="상태" value={formatStudentStatus(student.status)} />
              <DetailItem label="등록일" value={student.registeredOn ?? "-"} />
              <DetailItem
                label="담당 선생님"
                value={formatJoinedValue(student.teacherNames)}
              />
              <DetailItem
                label="악기"
                value={formatJoinedValue(student.instrumentNames)}
              />
              <DetailItem
                label="정기 요일"
                value={formatJoinedValue(student.weekdayLabels)}
              />
            </div>

            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">대표 수업 정보</h3>
              {primaryInstrument ? (
                <div className="grid gap-2 rounded-md border border-border bg-background p-4 text-sm sm:grid-cols-2">
                  <DetailItem
                    label="수업 형태"
                    value={formatLessonType(primaryInstrument.lessonType)}
                  />
                  <DetailItem
                    label="수업 시간"
                    value={`${primaryInstrument.startTime || "-"}-${primaryInstrument.endTime || "-"}`}
                  />
                  <DetailItem label="진도" value={primaryInstrument.progress || "-"} />
                  <DetailItem
                    label="월 수강료"
                    value={formatWon(primaryInstrument.lessonFee)}
                  />
                  <DetailItem
                    label="할인"
                    value={formatWon(primaryInstrument.discountTotal)}
                  />
                  <DetailItem
                    label="최종 수강료"
                    value={formatWon(primaryInstrument.finalMonthlyFee)}
                  />
                </div>
              ) : (
                <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
                  등록된 수업 정보가 없습니다.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                닫기
              </Button>
              <Button type="button" onClick={() => setIsEditing(true)}>
                <Pencil aria-hidden="true" />
                수정하기
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {student && isEditing ? (
          <StudentEditForm
            key={student.studentId}
            student={student}
            teachers={teachers}
            isSaving={isSaving}
            onCancel={() => setIsEditing(false)}
            onSubmit={async (input) => {
              await onSubmit(input);
              setIsEditing(false);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StudentEditForm({
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
  const firstTeacher = teachers[0];
  const initialTeacherId = primaryInstrument?.teacherId ?? firstTeacher?.teacherId ?? "";
  const [name, setName] = useState(student.name);
  const [teacherId, setTeacherId] = useState(initialTeacherId);
  const [instrumentId, setInstrumentId] = useState(
    primaryInstrument?.instrumentId || toInstrumentId(student.instrumentNames[0]),
  );
  const [instrumentName, setInstrumentName] = useState(
    primaryInstrument?.instrumentName ?? student.instrumentNames[0] ?? "",
  );
  const [lessonType, setLessonType] = useState(
    primaryInstrument?.lessonType === "private" ? "private" : "academy",
  );
  const [weekdayLabels, setWeekdayLabels] = useState(
    primaryInstrument?.weekdayLabels?.length
      ? primaryInstrument.weekdayLabels
      : student.weekdayLabels,
  );
  const [startTime, setStartTime] = useState(primaryInstrument?.startTime ?? "");
  const [endTime, setEndTime] = useState(primaryInstrument?.endTime ?? "");
  const [progress, setProgress] = useState(primaryInstrument?.progress ?? "");
  const [lessonFee, setLessonFee] = useState(primaryInstrument?.lessonFee ?? 0);
  const [discountTotal, setDiscountTotal] = useState(
    primaryInstrument?.discountTotal ?? 0,
  );
  const finalMonthlyFee = Math.max(0, lessonFee - discountTotal);
  const selectedTeacher =
    teachers.find((teacher) => teacher.teacherId === teacherId) ?? firstTeacher;
  const canSubmit = Boolean(name.trim() && instrumentName.trim());

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

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
          weekdayLabels,
          startTime,
          endTime,
          progress,
          lessonFee,
          discountTotal,
          finalMonthlyFee,
        });
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
          <span>담당 선생님</span>
          <NativeSelect
            aria-label="담당 선생님"
            value={teacherId}
            onChange={(event) => setTeacherId(event.target.value)}
          >
            {teachers.map((teacher) => (
              <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                {teacher.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Label className="grid gap-1">
          <span>악기 ID</span>
          <Input
            aria-label="악기 ID"
            value={instrumentId}
            onChange={(event) => setInstrumentId(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>악기명</span>
          <Input
            aria-label="악기명"
            value={instrumentName}
            onChange={(event) => setInstrumentName(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>수업 형태</span>
          <NativeSelect
            aria-label="수업 형태"
            value={lessonType}
            onChange={(event) =>
              setLessonType(event.target.value as "academy" | "private")
            }
          >
            <NativeSelectOption value="academy">학원 수업</NativeSelectOption>
            <NativeSelectOption value="private">개인레슨</NativeSelectOption>
          </NativeSelect>
        </Label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">정기 요일</legend>
        <div className="flex flex-wrap gap-3">
          {weekdayOptions.map((weekday) => (
            <Label key={weekday.value} className="flex items-center gap-2">
              <Checkbox
                aria-label={`${weekday.label}요일`}
                checked={weekdayLabels.includes(weekday.label)}
                onCheckedChange={(checked) =>
                  setWeekdayLabels((current) =>
                    checked
                      ? [...new Set([...current, weekday.label])]
                      : current.filter((value) => value !== weekday.label),
                  )
                }
              />
              <span>{weekday.label}</span>
            </Label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <Label className="grid gap-1">
          <span>시작 시간</span>
          <Input
            aria-label="시작 시간"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>종료 시간</span>
          <Input
            aria-label="종료 시간"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>진도</span>
          <Input
            aria-label="진도"
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
          />
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Label className="grid gap-1">
          <span>레슨비</span>
          <Input
            aria-label="레슨비"
            type="number"
            value={lessonFee}
            onChange={(event) => setLessonFee(Number(event.target.value))}
          />
        </Label>
        <Label className="grid gap-1">
          <span>할인</span>
          <Input
            aria-label="할인"
            type="number"
            value={discountTotal}
            onChange={(event) => setDiscountTotal(Number(event.target.value))}
          />
        </Label>
        <Label className="grid gap-1">
          <span>최종 수강료</span>
          <Input aria-label="최종 수강료" readOnly value={finalMonthlyFee} />
        </Label>
      </div>

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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function createDefaultQueryOptions(
  options: BuildStudentListOptions,
  supabaseClientState: SupabaseClientState,
): StudentListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.students.list(options.academyId, {
        q: options.search,
        teacherName: options.filters?.teacherName,
        instrumentName: options.filters?.instrumentName,
        weekdayLabel: options.filters?.weekdayLabel,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createStudentListQueryOptions(supabaseClientState.client, options);
}

function createDefaultTeacherOptionsQueryOptions(
  academyId: string,
  supabaseClientState: SupabaseClientState,
) {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.teachers.list(academyId),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createTeacherListQueryOptions(supabaseClientState.client, {
    academyId,
  });
}

function createStudentListSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as StudentSupabaseClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function createMissingSupabaseClientState(): SupabaseClientState {
  return {
    client: null,
    error: new Error("Supabase client 상태를 만들지 못했습니다."),
  };
}

function StudentListTable({
  students,
  onOpenStudent,
}: {
  students: StudentListRow[];
  onOpenStudent: (student: StudentListRow) => void;
}) {
  if (students.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 원생이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="원생 목록" className="min-w-[48rem]">
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">원생</TableHead>
            <TableHead className="px-4 py-3">선생님</TableHead>
            <TableHead className="px-4 py-3">악기</TableHead>
            <TableHead className="px-4 py-3">정기 요일</TableHead>
            <TableHead className="px-4 py-3 text-right">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.studentId}>
              <TableCell className="px-4 py-3 font-medium">
                {student.name}
              </TableCell>
              <TableCell className="px-4 py-3">
                {formatJoinedValue(student.teacherNames)}
              </TableCell>
              <TableCell className="px-4 py-3">
                {formatJoinedValue(student.instrumentNames)}
              </TableCell>
              <TableCell className="px-4 py-3">
                {formatJoinedValue(student.weekdayLabels)}
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${student.name} 자세히보기`}
                  onClick={() => onOpenStudent(student)}
                >
                  <Eye aria-hidden="true" />
                  자세히보기
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function buildFilterOptions(students: StudentListRow[]) {
  return {
    teacherNames: uniqueSorted(
      students.flatMap((student) => student.teacherNames),
    ),
    instrumentNames: uniqueSorted(
      students.flatMap((student) => student.instrumentNames),
    ),
    weekdayLabels: uniqueSorted(
      students.flatMap((student) => student.weekdayLabels),
    ),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "ko"),
  );
}

function formatJoinedValue(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-";
}

const weekdayOptions = [
  { value: "monday", label: "월" },
  { value: "tuesday", label: "화" },
  { value: "wednesday", label: "수" },
  { value: "thursday", label: "목" },
  { value: "friday", label: "금" },
  { value: "saturday", label: "토" },
  { value: "sunday", label: "일" },
];

function applyStudentUpdate(
  current: StudentListRow | null,
  input: UpdateStudentProfileInput,
): StudentListRow {
  const nextInstrument = input.studentInstrumentId
    ? {
        studentInstrumentId: input.studentInstrumentId,
        teacherId: input.teacherId ?? null,
        teacherName: input.teacherName ?? "",
        instrumentId: input.instrumentId ?? "",
        instrumentName: input.instrumentName ?? "",
        lessonType: input.lessonType ?? "academy",
        weekdayLabels: input.weekdayLabels ?? [],
        startTime: input.startTime ?? "",
        endTime: input.endTime ?? "",
        progress: input.progress ?? "",
        lessonFee: input.lessonFee ?? 0,
        discountTotal: input.discountTotal ?? 0,
        finalMonthlyFee: input.finalMonthlyFee ?? 0,
        active: true,
      }
    : undefined;

  return {
    academyId: input.academyId,
    studentId: input.studentId,
    name: input.name,
    registeredOn: current?.registeredOn,
    status: current?.status,
    teacherNames: input.teacherName ? [input.teacherName] : current?.teacherNames ?? [],
    instrumentNames: input.instrumentName
      ? [input.instrumentName]
      : current?.instrumentNames ?? [],
    weekdayLabels: input.weekdayLabels ?? current?.weekdayLabels ?? [],
    instruments: nextInstrument
      ? [
          nextInstrument,
          ...(current?.instruments ?? []).filter(
            (instrument) =>
              instrument.studentInstrumentId !== input.studentInstrumentId,
          ),
        ]
      : current?.instruments ?? [],
  };
}

function mergeStudentRow(
  current: StudentListRow | null,
  updated: StudentListRow,
): StudentListRow {
  return {
    ...updated,
    registeredOn: updated.registeredOn ?? current?.registeredOn,
    status: updated.status ?? current?.status,
    instruments:
      updated.instruments && updated.instruments.length > 0
        ? updated.instruments
        : current?.instruments,
  };
}

function formatStudentStatus(status: string | undefined) {
  if (status === "enrolled") {
    return "재원";
  }

  if (status === "suspended") {
    return "휴원";
  }

  if (status === "withdrawn") {
    return "퇴원";
  }

  return status ?? "-";
}

function formatLessonType(lessonType: string) {
  return lessonType === "private" ? "개인레슨" : "학원 수업";
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function toInstrumentId(value: string | undefined) {
  return value?.trim().toLocaleLowerCase("en-US").replace(/\s+/g, "-") ?? "";
}
