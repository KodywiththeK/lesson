"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { Button } from "@/components/ui/button";
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
  type RegisterStudentEnrollmentInput,
  type StudentRegistrationSupabaseClient,
  type StudentListSupabaseClient,
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
};

type StudentSupabaseClient = StudentListSupabaseClient &
  StudentRegistrationSupabaseClient &
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
}: StudentListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [weekdayLabel, setWeekdayLabel] = useState("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
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
  const students = studentListQuery.data?.items ?? [];
  const filterOptions = buildFilterOptions(studentListQuery.data?.items ?? []);

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
          <StudentListTable students={students} />
        ) : null}
      </div>
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

function StudentListTable({ students }: { students: StudentListRow[] }) {
  if (students.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 원생이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="원생 목록" className="min-w-[42rem]">
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">원생</TableHead>
            <TableHead className="px-4 py-3">선생님</TableHead>
            <TableHead className="px-4 py-3">악기</TableHead>
            <TableHead className="px-4 py-3">정기 요일</TableHead>
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
