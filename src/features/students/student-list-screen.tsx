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
  deleteWithdrawnStudent,
  registerStudentEnrollment,
  updateStudentProfile,
  updateStudentStatus,
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
  updateStudentStatus?: (
    input: {
      academyId: string;
      studentId: string;
      status: "enrolled" | "suspended" | "withdrawn";
    },
  ) => void | Promise<void>;
  deleteStudent?: (input: { academyId: string; studentId: string }) => void | Promise<void>;
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
  updateStudentStatus: updateStudentStatusProp,
  deleteStudent,
}: StudentListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [weekdayLabel, setWeekdayLabel] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 30>(10);
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
    page,
    pageSize,
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
        age: input.age,
        grade: input.grade,
        school: input.school,
        occupation: input.occupation,
        contact: input.contact,
        instruments: input.instruments,
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
  const statusMutation = useMutation({
    mutationFn: async (input: {
      academyId: string;
      studentId: string;
      status: "enrolled" | "suspended" | "withdrawn";
    }) => {
      if (updateStudentStatusProp) {
        await updateStudentStatusProp(input);
        return input;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await updateStudentStatus(supabaseClientState.client, input);
      return input;
    },
    onSuccess: (input) => {
      setStudentOverrides((current) => {
        const currentStudent =
          current[input.studentId] ??
          selectedStudent ??
          students.find((student) => student.studentId === input.studentId);

        if (!currentStudent) {
          return current;
        }

        return {
          ...current,
          [input.studentId]: {
            ...currentStudent,
            status: input.status,
          },
        };
      });
      setSelectedStudent((current) =>
        current?.studentId === input.studentId
          ? { ...current, status: input.status }
          : current,
      );
      toast.success("원생 상태를 변경했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "students"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "lesson-workspace"],
      });
    },
    onError: (error) => {
      toast.error("원생 상태 변경에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (input: { academyId: string; studentId: string }) => {
      if (deleteStudent) {
        await deleteStudent(input);
        return input;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await deleteWithdrawnStudent(supabaseClientState.client, input);
      return input;
    },
    onSuccess: (input) => {
      setStudentOverrides((current) => {
        const next = { ...current };
        delete next[input.studentId];
        return next;
      });
      setSelectedStudent(null);
      toast.success("퇴원 원생을 삭제했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "students"],
      });
    },
    onError: (error) => {
      toast.error("원생 삭제에 실패했습니다.", {
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
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
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="이름, 선생님, 악기, 요일"
          />

          <ListFilterSelect
            label="선생님 필터"
            value={teacherName}
            options={filterOptions.teacherNames}
            onChange={(value) => {
              setTeacherName(value);
              setPage(1);
            }}
          />
          <ListFilterSelect
            label="악기 필터"
            value={instrumentName}
            options={filterOptions.instrumentNames}
            onChange={(value) => {
              setInstrumentName(value);
              setPage(1);
            }}
          />
          <ListFilterSelect
            label="요일 필터"
            value={weekdayLabel}
            options={filterOptions.weekdayLabels}
            onChange={(value) => {
              setWeekdayLabel(value);
              setPage(1);
            }}
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
              setPage(1);
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
          <>
            <StudentListTable
              students={students}
              onOpenStudent={setSelectedStudent}
            />
            <StudentPagination
              view={studentListQuery.data}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </>
        ) : null}
      </div>

      <StudentDetailDialog
        student={selectedStudent}
        teachers={teacherOptions}
        isSaving={updateMutation.isPending}
        isStatusSaving={statusMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null);
          }
        }}
        onSubmit={(input) => updateMutation.mutateAsync(input)}
        onStatusChange={(input) => statusMutation.mutateAsync(input)}
        onDelete={(input) => deleteMutation.mutateAsync(input)}
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
  const [name, setName] = useState("");
  const [registeredAt, setRegisteredAt] = useState(toSeoulDate(new Date()));
  const [age, setAge] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [occupation, setOccupation] = useState("");
  const [contactRelationship, setContactRelationship] = useState("모");
  const [contactPhone, setContactPhone] = useState("");
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState(["piano"]);
  const [instrumentDrafts, setInstrumentDrafts] = useState<
    Record<string, StudentRegistrationInstrumentDraft>
  >(() => ({
    piano: createRegistrationInstrumentDraft(instrumentOptions[0], teachers),
  }));

  const orderedDrafts = selectedInstrumentIds
    .map((instrumentId) => instrumentDrafts[instrumentId])
    .filter(Boolean);
  const canSubmit = Boolean(
    name.trim() &&
      registeredAt &&
      contactPhone.replace(/\D/g, "").length >= 4 &&
      orderedDrafts.length > 0 &&
      orderedDrafts.every(
        (draft) =>
          draft.weeklySchedules.length > 0 &&
          !draft.weeklySchedules.some(
            (schedule) =>
              Boolean(schedule.startTime) !== Boolean(schedule.endTime),
          ),
      ),
  );

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({
          name: name.trim(),
          registeredAt,
          age: age ? Number(age) : undefined,
          grade: grade.trim() || undefined,
          school: school.trim() || undefined,
          occupation: occupation.trim() || undefined,
          contact: {
            relationship: contactRelationship.trim() || "본인",
            phone: contactPhone.trim(),
          },
          instruments: orderedDrafts.map((draft) => {
            const effectiveTeacherId =
              draft.teacherId || getDefaultTeacherId(draft.instrumentName, teachers);
            const teacher = teachers.find(
              (option) => option.teacherId === effectiveTeacherId,
            );

            return {
              instrumentId: draft.instrumentId,
              instrumentName: draft.instrumentName,
              teacherId: effectiveTeacherId,
              teacherName: teacher?.name ?? "",
              lessonType: draft.lessonType,
              weeklySchedules: draft.weeklySchedules,
              progress: draft.progress.trim() || "신규 등록",
              lessonFee: draft.lessonFee,
              discountTotal: draft.discountTotal,
              discountLabel:
                draft.discountLabel === "직접입력"
                  ? draft.customDiscountLabel.trim() || "직접입력"
                  : draft.discountLabel,
              finalMonthlyFee: Math.max(0, draft.lessonFee - draft.discountTotal),
            };
          }),
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
          <Input
            aria-label="학년"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            placeholder="초등 1학년"
          />
        </Label>
        <Label className="grid gap-1">
          <span>학교</span>
          <Input
            aria-label="학교"
            value={school}
            onChange={(event) => setSchool(event.target.value)}
          />
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
            <NativeSelectOption value="모">모</NativeSelectOption>
            <NativeSelectOption value="부">부</NativeSelectOption>
            <NativeSelectOption value="본인">본인</NativeSelectOption>
            <NativeSelectOption value="보호자">보호자</NativeSelectOption>
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>연락처</span>
          <Input
            aria-label="연락처"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="010-0000-0000"
          />
        </Label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">
          악기 선택 <span className="text-muted-foreground">(복수 선택 가능)</span>
        </legend>
        <div className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-4">
          {instrumentOptions.map((instrument) => (
            <Label key={instrument.id} className="flex items-center gap-2">
              <Checkbox
                aria-label={`${instrument.name} 선택`}
                checked={selectedInstrumentIds.includes(instrument.id)}
                onCheckedChange={(checked) => {
                  setSelectedInstrumentIds((current) =>
                    checked
                      ? [...new Set([...current, instrument.id])]
                      : current.filter((value) => value !== instrument.id),
                  );
                  setInstrumentDrafts((current) => {
                    if (checked && !current[instrument.id]) {
                      return {
                        ...current,
                        [instrument.id]: createRegistrationInstrumentDraft(
                          instrument,
                          teachers,
                        ),
                      };
                    }

                    return current;
                  });
                }}
              />
              <span>{instrument.name}</span>
            </Label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3">
        {orderedDrafts.map((draft) => (
          <StudentRegistrationInstrumentCard
            key={draft.instrumentId}
            draft={draft}
            teachers={teachers}
            onChange={(nextDraft) =>
              setInstrumentDrafts((current) => ({
                ...current,
                [draft.instrumentId]: nextDraft,
              }))
            }
          />
        ))}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          등록
        </Button>
      </DialogFooter>
    </form>
  );
}

function StudentRegistrationInstrumentCard({
  draft,
  teachers,
  onChange,
}: {
  draft: StudentRegistrationInstrumentDraft;
  teachers: TeacherListRow[];
  onChange: (draft: StudentRegistrationInstrumentDraft) => void;
}) {
  const teacherCandidates = getTeacherCandidates(draft.instrumentName, teachers);
  const effectiveTeacherId =
    draft.teacherId || getDefaultTeacherId(draft.instrumentName, teachers);
  const finalMonthlyFee = Math.max(0, draft.lessonFee - draft.discountTotal);

  return (
    <section className="grid gap-4 rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">
          [{draft.instrumentName}] 상세 설정
        </h3>
        <span className="text-xs font-medium text-muted-foreground">
          {draft.instrumentName === "피아노"
            ? "학원레슨/개인레슨 선택 가능"
            : "개인레슨 전용"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>담당 선생님</span>
          <NativeSelect
            aria-label={`${draft.instrumentName} 담당 선생님`}
            value={effectiveTeacherId}
            onChange={(event) =>
              onChange({ ...draft, teacherId: event.target.value })
            }
          >
            <NativeSelectOption value="">미배정</NativeSelectOption>
            {teacherCandidates.map((teacher) => (
              <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                {teacher.name} ({teacher.part})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>레슨 형태</span>
          <NativeSelect
            aria-label={`${draft.instrumentName} 레슨 형태`}
            value={draft.lessonType}
            disabled={draft.instrumentName !== "피아노"}
            onChange={(event) =>
              onChange({
                ...draft,
                lessonType: event.target.value as "academy" | "private",
              })
            }
          >
            <NativeSelectOption value="academy">학원레슨</NativeSelectOption>
            <NativeSelectOption value="private">개인레슨</NativeSelectOption>
          </NativeSelect>
        </Label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">수강 요일</legend>
        <div className="flex flex-wrap gap-3 rounded-md border border-border bg-muted/40 p-3">
          {weekdayOptions.map((weekday) => (
            <Label key={weekday.value} className="flex items-center gap-2">
              <Checkbox
                aria-label={`${draft.instrumentName} ${weekday.label}요일`}
                checked={draft.weeklySchedules.some(
                  (schedule) => schedule.weekday === weekday.value,
                )}
                onCheckedChange={(checked) =>
                  onChange({
                    ...draft,
                    weeklySchedules: checked
                      ? [
                          ...draft.weeklySchedules,
                          { weekday: weekday.value },
                        ]
                      : draft.weeklySchedules.filter(
                          (schedule) => schedule.weekday !== weekday.value,
                        ),
                  })
                }
              />
              <span>{weekday.label}</span>
            </Label>
          ))}
        </div>
      </fieldset>

      {draft.weeklySchedules.length > 0 ? (
        <div className="grid gap-2">
          {draft.weeklySchedules.map((schedule) => {
            const weekdayLabel =
              weekdayOptions.find((weekday) => weekday.value === schedule.weekday)
                ?.label ?? schedule.weekday;

            return (
              <div
                key={schedule.weekday}
                className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr]"
              >
                <span className="self-center text-sm font-medium">
                  {weekdayLabel}
                </span>
                <Input
                  aria-label={`${draft.instrumentName} ${weekdayLabel} 시작 시간`}
                  type="time"
                  value={schedule.startTime ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      weeklySchedules: draft.weeklySchedules.map((current) =>
                        current.weekday === schedule.weekday
                          ? { ...current, startTime: event.target.value }
                          : current,
                      ),
                    })
                  }
                />
                <Input
                  aria-label={`${draft.instrumentName} ${weekdayLabel} 종료 시간`}
                  type="time"
                  value={schedule.endTime ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      weeklySchedules: draft.weeklySchedules.map((current) =>
                        current.weekday === schedule.weekday
                          ? { ...current, endTime: event.target.value }
                          : current,
                      ),
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Label className="grid gap-1">
          <span>레슨비</span>
          <Input
            aria-label={`${draft.instrumentName} 레슨비`}
            type="number"
            value={draft.lessonFee}
            onChange={(event) =>
              onChange({ ...draft, lessonFee: Number(event.target.value) })
            }
          />
        </Label>
        <Label className="grid gap-1">
          <span>할인 구분</span>
          <NativeSelect
            aria-label={`${draft.instrumentName} 할인 구분`}
            value={draft.discountLabel}
            onChange={(event) =>
              onChange({ ...draft, discountLabel: event.target.value })
            }
          >
            {discountOptions.map((discount) => (
              <NativeSelectOption key={discount} value={discount}>
                {discount}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>할인액</span>
          <Input
            aria-label={`${draft.instrumentName} 할인액`}
            type="number"
            value={draft.discountTotal}
            onChange={(event) =>
              onChange({ ...draft, discountTotal: Number(event.target.value) })
            }
          />
        </Label>
        <Label className="grid gap-1">
          <span>최종 금액</span>
          <Input
            aria-label={`${draft.instrumentName} 최종 금액`}
            readOnly
            value={finalMonthlyFee}
          />
        </Label>
      </div>

      {draft.discountLabel === "직접입력" ? (
        <Label className="grid gap-1">
          <span>할인 사유</span>
          <Input
            aria-label={`${draft.instrumentName} 할인 사유`}
            value={draft.customDiscountLabel}
            onChange={(event) =>
              onChange({
                ...draft,
                customDiscountLabel: event.target.value,
              })
            }
          />
        </Label>
      ) : null}

      <Label className="grid gap-1">
        <span>진도</span>
        <Input
          aria-label={`${draft.instrumentName} 진도`}
          value={draft.progress}
          onChange={(event) =>
            onChange({ ...draft, progress: event.target.value })
          }
        />
      </Label>
    </section>
  );
}

function StudentDetailDialog({
  student,
  teachers,
  isSaving,
  isStatusSaving,
  isDeleting,
  onOpenChange,
  onSubmit,
  onStatusChange,
  onDelete,
}: {
  student: StudentListRow | null;
  teachers: TeacherListRow[];
  isSaving: boolean;
  isStatusSaving: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: UpdateStudentProfileInput) => Promise<StudentListRow>;
  onStatusChange: (input: {
    academyId: string;
    studentId: string;
    status: "enrolled" | "suspended" | "withdrawn";
  }) => Promise<unknown>;
  onDelete: (input: { academyId: string; studentId: string }) => Promise<unknown>;
}) {
  const [isEditing, setIsEditing] = useState(false);

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
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
              <DetailItem label="출석 ID" value={student.attendanceCode ?? "-"} />
              <DetailItem label="나이" value={student.age ? `${student.age}세` : "-"} />
              <DetailItem label="학년" value={student.grade ?? "-"} />
              <DetailItem label="학교" value={student.school ?? "-"} />
              <DetailItem label="직업" value={student.occupation ?? "-"} />
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
              <h3 className="text-sm font-semibold">연락처</h3>
              {student.contacts?.length ? (
                <div className="grid gap-2 rounded-md border border-border bg-background p-4 text-sm">
                  {student.contacts.map((contact) => (
                    <div
                      key={`${contact.relationship}-${contact.phone}`}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="font-medium">{contact.relationship}</span>
                      <span>{contact.phone}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
                  등록된 연락처가 없습니다.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">악기별 수업 정보</h3>
              {student.instruments?.length ? (
                <div className="grid gap-3">
                  {student.instruments.map((instrument) => (
                    <div
                      key={instrument.studentInstrumentId || instrument.instrumentName}
                      className="grid gap-2 rounded-md border border-border bg-background p-4 text-sm sm:grid-cols-2"
                    >
                      <DetailItem label="악기" value={instrument.instrumentName} />
                      <DetailItem
                        label="담당 선생님"
                        value={instrument.teacherName || "미배정"}
                      />
                      <DetailItem
                        label="수업 형태"
                        value={formatLessonType(instrument.lessonType)}
                      />
                      <DetailItem
                        label="요일/시간"
                        value={formatWeeklySchedules(instrument.weeklySchedules)}
                      />
                      <DetailItem label="진도" value={instrument.progress || "-"} />
                      <DetailItem
                        label="월 수강료"
                        value={formatWon(instrument.lessonFee)}
                      />
                      <DetailItem
                        label="할인"
                        value={`${instrument.discountLabel ?? "없음"} / ${formatWon(
                          instrument.discountTotal,
                        )}`}
                      />
                      <DetailItem
                        label="최종 수강료"
                        value={formatWon(instrument.finalMonthlyFee)}
                      />
                    </div>
                  ))}
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
                disabled={isStatusSaving || student.status === "suspended"}
                onClick={() =>
                  void onStatusChange({
                    academyId: student.academyId,
                    studentId: student.studentId,
                    status: "suspended",
                  })
                }
              >
                휴원
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isStatusSaving || student.status === "withdrawn"}
                onClick={() => {
                  if (!window.confirm(`${student.name} 원생을 퇴원 처리할까요?`)) {
                    return;
                  }

                  void onStatusChange({
                    academyId: student.academyId,
                    studentId: student.studentId,
                    status: "withdrawn",
                  });
                }}
              >
                퇴원
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  isDeleting ||
                  student.status !== "withdrawn"
                }
                onClick={() => {
                  if (!window.confirm(`${student.name} 원생을 완전히 삭제할까요?`)) {
                    return;
                  }

                  void onDelete({
                    academyId: student.academyId,
                    studentId: student.studentId,
                  });
                }}
              >
                삭제
              </Button>
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
        page: String(options.page ?? 1),
        pageSize: String(options.pageSize ?? ""),
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

function StudentPagination({
  view,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  view: ListView<StudentListRow> | undefined;
  pageSize: 10 | 20 | 30;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 10 | 20 | 30) => void;
}) {
  if (!view || view.totalItems <= 10) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        총 {view.totalItems}명 · {view.page}/{view.totalPages}페이지
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="flex items-center gap-2 text-sm">
          <span>페이지당</span>
          <NativeSelect
            aria-label="페이지당 원생 수"
            value={String(pageSize)}
            onChange={(event) =>
              onPageSizeChange(Number(event.target.value) as 10 | 20 | 30)
            }
          >
            <NativeSelectOption value="10">10명</NativeSelectOption>
            <NativeSelectOption value="20">20명</NativeSelectOption>
            <NativeSelectOption value="30">30명</NativeSelectOption>
          </NativeSelect>
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!view.hasPreviousPage}
          onClick={() => onPageChange(view.page - 1)}
        >
          이전
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!view.hasNextPage}
          onClick={() => onPageChange(view.page + 1)}
        >
          다음
        </Button>
      </div>
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

type StudentRegistrationInstrumentDraft = {
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  lessonType: "academy" | "private";
  weeklySchedules: Array<{
    weekday: string;
    startTime?: string;
    endTime?: string;
  }>;
  lessonFee: number;
  discountTotal: number;
  discountLabel: string;
  customDiscountLabel: string;
  progress: string;
};

const instrumentOptions = [
  { id: "piano", name: "피아노" },
  { id: "violin", name: "바이올린" },
  { id: "cello", name: "첼로" },
  { id: "flute", name: "플루트" },
];

const discountOptions = [
  "없음",
  "형제할인",
  "복수악기할인",
  "소개할인",
  "직접입력",
];

function createRegistrationInstrumentDraft(
  instrument: (typeof instrumentOptions)[number],
  teachers: TeacherListRow[],
): StudentRegistrationInstrumentDraft {
  return {
    instrumentId: instrument.id,
    instrumentName: instrument.name,
    teacherId: getDefaultTeacherId(instrument.name, teachers),
    lessonType: instrument.name === "피아노" ? "academy" : "private",
    weeklySchedules: [],
    lessonFee: instrument.name === "피아노" ? 150000 : 0,
    discountTotal: 0,
    discountLabel: "없음",
    customDiscountLabel: "",
    progress: "신규 등록",
  };
}

function getDefaultTeacherId(instrumentName: string, teachers: TeacherListRow[]) {
  const candidates = getTeacherCandidates(instrumentName, teachers);

  return candidates.length === 1 ? candidates[0].teacherId : "";
}

function getTeacherCandidates(instrumentName: string, teachers: TeacherListRow[]) {
  return teachers
    .filter((teacher) => teacher.part === instrumentName)
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

function formatJoinedValue(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-";
}

function formatWeeklySchedules(
  schedules:
    | Array<{
        weekday: string;
        weekdayLabel: string;
        startTime: string;
        endTime: string;
      }>
    | undefined,
) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return "-";
  }

  return schedules
    .map((schedule) => {
      const label =
        schedule.weekdayLabel ||
        weekdayOptions.find((weekday) => weekday.value === schedule.weekday)?.label ||
        schedule.weekday;
      const time =
        schedule.startTime && schedule.endTime
          ? ` ${schedule.startTime}-${schedule.endTime}`
          : "";

      return `${label}${time}`;
    })
    .join(", ");
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

function toSeoulDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
