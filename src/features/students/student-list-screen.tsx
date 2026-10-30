"use client";

import { useId, useMemo, useState } from "react";
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
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import type { ListView } from "@/domain/common-list";
import { getFinanceToday } from "@/domain/finance-date";
import { STUDENT_DISCOUNTS } from "@/domain/lesson-pricing";
import { getStudentDisplayGrade } from "@/domain/student-grade";
import {
  applyStudentEnrollmentSave,
  getRemainingEventNotice,
  type StudentEnrollmentSaveResult,
  type UpdateStudentEnrollmentsInput,
} from "@/domain/student-enrollment-edit";
import {
  buildStudentFilterOptions,
  calculateStudentMonthlyTuitionSummary,
  DEFAULT_STUDENT_SORT,
  getStudentDisplayAge,
  STUDENT_SORT_OPTIONS,
  type BuildStudentListOptions,
  type StudentListInstrument,
  type StudentListRow,
  type StudentSort,
  type StudentSortKey,
} from "@/domain/student-list";
import { invalidateAfterPeopleChange } from "@/lib/api/query-invalidation";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  createStudentListQueryKey,
  createStudentListQueryOptions,
  createStudentOptionsQueryOptions,
  registerStudentEnrollment,
  updateStudentEnrollments,
  updateStudentStatus,
  type RegisterStudentEnrollmentInput,
  type StudentRegistrationSupabaseClient,
  type StudentListSupabaseClient,
  type StudentUpdateSupabaseClient,
} from "@/lib/api/students";
import {
  createTeacherOptionsQueryOptions,
  type TeacherListSupabaseClient,
} from "@/lib/api/teachers";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TeacherListRow } from "@/domain/teacher-list";

import { StudentEditForm } from "./student-edit-form";
import { toStudentSaveFailureMessage } from "./student-edit-save";
import { instrumentOptions, weekdayOptions } from "./student-form-options";
import {
  StudentRegistrationDialog,
  type StudentRegistrationSubmission,
} from "./student-registration-dialog";
import { STUDENT_LESSON_TYPE_LABELS } from "./student-registration-instrument";
import { useStudentRowOverrides } from "./student-row-overrides";

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
  registerStudent?: (input: StudentRegistrationSubmission) => void | Promise<void>;
  updateStudent?: (
    input: UpdateStudentEnrollmentsInput,
  ) => void | StudentEnrollmentSaveResult | Promise<void | StudentEnrollmentSaveResult>;
  updateStudentStatus?: (
    input: {
      academyId: string;
      studentId: string;
      status: "enrolled" | "suspended" | "withdrawn";
      reason?: string;
    },
  ) => void | Promise<void>;
};

type StudentStatusChangeRequest = {
  student: StudentListRow;
  nextStatus: "suspended" | "withdrawn";
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
  queryOptionsFactory,
  teachers = [],
  registerStudent,
  updateStudent,
  updateStudentStatus: updateStudentStatusProp,
}: StudentListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [weekdayLabel, setWeekdayLabel] = useState("");
  const [sort, setSort] = useState<StudentSort>(DEFAULT_STUDENT_SORT);
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentListRow | null>(
    null,
  );
  const [pendingStatusChange, setPendingStatusChange] =
    useState<StudentStatusChangeRequest | null>(null);
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
    sort,
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
  const studentListView = studentListQuery.data;
  const rowOverrides = useStudentRowOverrides(studentListView);
  const students = rowOverrides.resolve(studentListView?.items ?? []);
  // 상세 창은 열 때의 스냅샷이지만, 현재 목록에 같은 원생이 있으면 그 행을 보여 줘 낡은 값이 남지 않게 한다.
  const detailStudent = selectedStudent
    ? (students.find((student) => student.studentId === selectedStudent.studentId) ??
      rowOverrides.resolve(selectedStudent))
    : null;
  const teacherOptionsQuery = useQuery({
    ...createDefaultTeacherOptionsQueryOptions(
      academyId,
      supabaseClientState ?? createMissingSupabaseClientState(),
    ),
    enabled: !teachers.length && !hasInjectedQueryOptions && !supabaseClientState?.error,
  });
  const teacherOptions = useMemo(
    () => (teachers.length ? teachers : teacherOptionsQuery.data ?? []),
    [teacherOptionsQuery.data, teachers],
  );
  const studentOptionsQuery = useQuery({
    ...createDefaultStudentOptionsQueryOptions(
      academyId,
      supabaseClientState ?? createMissingSupabaseClientState(),
    ),
    enabled: !hasInjectedQueryOptions && !supabaseClientState?.error,
  });
  const registerMutation = useMutation({
    mutationFn: async (input: StudentRegistrationSubmission) => {
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
        birthYear: input.birthYear,
        grade: input.grade,
        school: input.school,
        occupation: input.occupation,
        contact: input.contact,
        secondaryContact: input.secondaryContact,
        instruments: input.instruments,
      } satisfies RegisterStudentEnrollmentInput);
    },
    onSuccess: () => {
      setIsRegistrationOpen(false);
      toast.success("원생을 등록했습니다.");
      invalidateAfterPeopleChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("원생 등록에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const statusMutation = useMutation({
    mutationFn: async (input: {
      academyId: string;
      studentId: string;
      status: "enrolled" | "suspended" | "withdrawn";
      reason?: string;
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
      const currentStudent =
        detailStudent ?? students.find((student) => student.studentId === input.studentId);

      // 합칠 원생 행을 알 수 없으면 부분 행을 만들지 않고 다시 불러온 결과를 따른다.
      if (currentStudent) {
        const updatedStudent = { ...currentStudent, status: input.status };

        rowOverrides.apply(updatedStudent);
        setSelectedStudent((current) =>
          current?.studentId === input.studentId ? updatedStudent : current,
        );
      }
      toast.success("원생 상태를 변경했습니다.");
      invalidateAfterPeopleChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("원생 상태 변경에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (input: UpdateStudentEnrollmentsInput) => {
      if (updateStudent) {
        return { input, result: (await updateStudent(input)) ?? undefined };
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return { input, result: await updateStudentEnrollments(supabaseClientState.client, input) };
    },
    onSuccess: ({ input, result }) => {
      const currentStudent =
        detailStudent ?? students.find((student) => student.studentId === input.studentId);
      const remainingEventNotice = result ? getRemainingEventNotice(result) : null;
      const discountNotice = result?.discountSnapshotWarning
        ? "기존 수강료의 할인 구성을 확인할 수 없어 자동 반영하지 않았습니다. 원장에게 정정을 요청해 주세요."
        : null;

      // 합칠 원생 행을 알 수 없으면 부분 행을 만들지 않고 다시 불러온 결과를 따른다.
      if (currentStudent) {
        const mergedStudent = applyStudentEnrollmentSave(currentStudent, input, result);

        rowOverrides.apply(mergedStudent);
        setSelectedStudent(mergedStudent);
      }
      toast.success("원생 정보를 수정했습니다.", {
        description: [remainingEventNotice, discountNotice].filter(Boolean).join(" ") || undefined,
      });
      invalidateAfterPeopleChange(queryClient, academyId);
    },
    onError: (error) => {
      // 서버가 한 트랜잭션으로 처리해 실패하면 아무것도 저장되지 않는다. 폼은 입력값을 그대로 둔다.
      toast.error("원생 정보 수정에 실패했습니다.", {
        description: toStudentSaveFailureMessage(error),
      });
    },
  });
  const filterOptions = buildStudentFilterOptions(studentOptionsQuery.data ?? [], {
    teacherNames: teacherOptions.map((teacher) => teacher.name),
    instrumentNames: instrumentOptions.map((instrument) => instrument.name),
  });
  const existingStudentNames = useMemo(
    () => (studentOptionsQuery.data ?? studentListView?.items ?? []).map((student) => student.name),
    [studentOptionsQuery.data, studentListView?.items],
  );
  const registrationAction = useMemo(
    () => (
      <StudentRegistrationDialog
        open={isRegistrationOpen}
        onOpenChange={setIsRegistrationOpen}
        trigger={
          <Button type="button">
            <UserPlus aria-hidden="true" />
            원생 등록
          </Button>
        }
        teachers={teacherOptions}
        existingStudentNames={existingStudentNames}
        onSubmit={(input) => registerMutation.mutateAsync(input)}
      />
    ),
    [existingStudentNames, isRegistrationOpen, registerMutation, teacherOptions],
  );
  const isHeaderActionMounted = usePageHeaderActions(registrationAction);

  return (
    <section className="grid gap-4" aria-label="원생 목록">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {registrationAction}
      </PageHeaderActionFallback>

      <SectionCard padded={false}>
        <div
          role="group"
          aria-label="검색·필터·정렬"
          className="grid min-w-0 gap-3 border-b border-border p-4"
        >
          <ListSearchField
            label="원생 검색"
            value={search}
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
            placeholder="이름, 선생님, 악기, 요일"
          />

          {/* 열 폭은 카드 폭을 균등 분할(grid-cols-N = minmax(0,1fr))하고, NativeSelect 래퍼(w-fit)가 가장 긴 선택지 폭으로 열을 밀지 않게 칸을 꽉 채운다. */}
          <div className="grid min-w-0 grid-cols-2 gap-3 *:min-w-0 md:grid-cols-3 2xl:grid-cols-6 [&_[data-slot=native-select-wrapper]]:w-full">
            <ListFilterSelect
              label="선생님 필터"
              value={teacherName}
              options={filterOptions.teacherNames}
              onChange={(value) => {
                setTeacherName(value);
                resetPage();
              }}
            />
            <ListFilterSelect
              label="악기 필터"
              value={instrumentName}
              options={filterOptions.instrumentNames}
              onChange={(value) => {
                setInstrumentName(value);
                resetPage();
              }}
            />
            <ListFilterSelect
              label="요일 필터"
              value={weekdayLabel}
              options={filterOptions.weekdayLabels}
              onChange={(value) => {
                setWeekdayLabel(value);
                resetPage();
              }}
            />

            <Label className="grid gap-1 text-sm font-medium">
              <span>정렬 기준</span>
              <NativeSelect
                aria-label="정렬 기준"
                className="w-full"
                value={sort.key}
                onChange={(event) => {
                  setSort({ ...sort, key: event.target.value as StudentSortKey });
                  resetPage();
                }}
              >
                {STUDENT_SORT_OPTIONS.map((option) => (
                  <NativeSelectOption key={option.key} value={option.key}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Label>
            <Label className="grid gap-1 text-sm font-medium">
              <span>정렬 방향</span>
              <NativeSelect
                aria-label="정렬 방향"
                className="w-full"
                value={sort.direction}
                onChange={(event) => {
                  setSort({ ...sort, direction: event.target.value as StudentSort["direction"] });
                  resetPage();
                }}
              >
                <NativeSelectOption value="asc">오름차순</NativeSelectOption>
                <NativeSelectOption value="desc">내림차순</NativeSelectOption>
              </NativeSelect>
            </Label>

            <Button
              type="button"
              variant="outline"
              className="self-end"
              onClick={() => {
                setSearch("");
                setTeacherName("");
                setInstrumentName("");
                setWeekdayLabel("");
                setSort(DEFAULT_STUDENT_SORT);
                resetPage();
              }}
            >
              <RotateCcw aria-hidden="true" />
              초기화
            </Button>
          </div>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="원생 목록을 불러오지 못했습니다."
            detail={toUserMessage(supabaseClientState.error)}
          />
        ) : null}

        {studentListQuery.isError ? (
          <ListStatusAlert
            message="원생 목록을 불러오지 못했습니다."
            detail={toUserMessage(studentListQuery.error)}
          />
        ) : null}

        {studentListQuery.isLoading ? (
          <EmptyState>
            원생 목록을 불러오는 중입니다.
          </EmptyState>
        ) : null}

        {studentListView && !studentListQuery.isError ? (
          <>
            <StudentListTable
              students={students}
              onOpenStudent={setSelectedStudent}
            />
            <ListPagination
              itemLabel="원생"
              countUnit="명"
              view={studentListView}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : null}
      </SectionCard>

      <StudentDetailDialog
        student={detailStudent}
        teachers={teacherOptions}
        isSaving={updateMutation.isPending}
        isStatusSaving={statusMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null);
          }
        }}
        onSubmit={async (input) => {
          await updateMutation.mutateAsync(input);
        }}
        onRequestStatusChange={setPendingStatusChange}
      />
      <StudentStatusConfirmationDialog
        request={pendingStatusChange}
        isSaving={statusMutation.isPending}
        onCancel={() => setPendingStatusChange(null)}
        onConfirm={(input) => statusMutation.mutateAsync(input)}
      />
    </section>
  );
}

function StudentDetailDialog({
  student,
  teachers,
  isSaving,
  isStatusSaving,
  onOpenChange,
  onSubmit,
  onRequestStatusChange,
}: {
  student: StudentListRow | null;
  teachers: TeacherListRow[];
  isSaving: boolean;
  isStatusSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: UpdateStudentEnrollmentsInput) => Promise<void>;
  onRequestStatusChange: (request: StudentStatusChangeRequest) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const deleteUnavailableNoticeId = useId();
  const isWithdrawnStudent = student?.status === "withdrawn";
  const tuitionSummary = calculateStudentMonthlyTuitionSummary(student?.instruments);

  return (
    <Dialog
      open={Boolean(student)}
      onOpenChange={(open) => {
        // 저장하는 동안 닫으면 저장 결과를 합칠 원생 행이 없어진다. 끝날 때까지 열어 둔다.
        if (!open && isSaving) {
          return;
        }

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
            원생의 기본 정보와 악기별 수업 정보를 확인하고 수정합니다.
          </DialogDescription>
        </DialogHeader>

        {student && !isEditing ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-md border border-border bg-background p-4 sm:grid-cols-2">
              <DetailItem label="원생명" value={student.name} />
              <DetailItem label="상태" value={formatStudentStatus(student.status)} />
              <DetailItem label="등록일" value={student.registeredOn ?? "-"} />
              <DetailItem label="출석 ID" value={student.attendanceCode ?? "-"} />
              <DetailItem label="나이" value={formatAge(getStudentDisplayAge(student))} />
              <DetailItem
                label="출생연도"
                value={student.birthYear === undefined ? "-" : `${student.birthYear}년`}
              />
              <DetailItem label="학년" value={getStudentDisplayGrade(student, getFinanceToday()) || "-"} />
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

            <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-3">
              <DetailItem
                label="할인 전 월 합계"
                value={formatWon(tuitionSummary.grossMonthlyFee)}
              />
              <DetailItem
                label="매월 할인 합계"
                value={formatWon(tuitionSummary.monthlyDiscountTotal)}
              />
              <DetailItem
                label="최종 월 수강료"
                value={formatWon(tuitionSummary.finalMonthlyFee)}
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
                      {instrument.referralDiscountMonth ? (
                        <DetailItem
                          label="지인 소개 할인"
                          value={formatReferralDiscount(instrument)}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
                  등록된 수업 정보가 없습니다.
                </p>
              )}
            </div>

            {isWithdrawnStudent ? (
              <p
                id={deleteUnavailableNoticeId}
                className="text-sm text-muted-foreground"
              >
                결제·회차권·급여 기록을 보존하기 위해 삭제할 수 없습니다. 보관 상태로 유지됩니다.
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isStatusSaving || student.status === "suspended"}
                onClick={() =>
                  onRequestStatusChange({
                    student,
                    nextStatus: "suspended",
                  })
                }
              >
                휴원
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isStatusSaving || student.status === "withdrawn"}
                onClick={() =>
                  onRequestStatusChange({
                    student,
                    nextStatus: "withdrawn",
                  })
                }
              >
                퇴원
              </Button>
              {isWithdrawnStudent ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled
                  aria-describedby={deleteUnavailableNoticeId}
                >
                  삭제
                </Button>
              ) : null}
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

function StudentStatusConfirmationDialog({
  request,
  isSaving,
  onCancel,
  onConfirm,
}: {
  request: StudentStatusChangeRequest | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    academyId: string;
    studentId: string;
    status: "suspended" | "withdrawn";
    reason?: string;
  }) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const student = request?.student ?? null;
  const nextStatus = request?.nextStatus ?? null;
  const nextLabel = nextStatus ? formatStudentStatus(nextStatus) : "";

  return (
    <AlertDialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          setReason("");
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>상태 변경 확인</AlertDialogTitle>
          <AlertDialogDescription>
            {student
              ? `${student.name} 원생 상태를 ${formatStudentStatus(
                  student.status,
                )}에서 ${nextLabel}으로 변경합니다. 퇴원은 30일 보관 후 자동으로 보관 처리됩니다.`
              : "원생 상태를 변경합니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="grid gap-1 text-sm font-medium">
          <span>상태 변경 메모</span>
          <Textarea
            aria-label="상태 변경 메모"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="선택 입력"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>취소</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSaving || !student || !nextStatus}
            onClick={(event) => {
              event.preventDefault();

              if (!student || !nextStatus) {
                return;
              }

              void onConfirm({
                academyId: student.academyId,
                studentId: student.studentId,
                status: nextStatus,
                reason: reason.trim() || undefined,
              }).then(() => {
                setReason("");
                onCancel();
              }).catch(() => undefined);
            }}
          >
            처리
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
      queryKey: createStudentListQueryKey(options),
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
      queryKey: queryKeys.teachers.options(academyId),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createTeacherOptionsQueryOptions(supabaseClientState.client, academyId);
}

function createDefaultStudentOptionsQueryOptions(
  academyId: string,
  supabaseClientState: SupabaseClientState,
) {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.students.options(academyId),
      queryFn: async (): Promise<StudentListRow[]> => {
        throw supabaseClientState.error;
      },
    };
  }

  return createStudentOptionsQueryOptions(supabaseClientState.client, academyId);
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
      <EmptyState>
        조건에 맞는 원생이 없습니다.
      </EmptyState>
    );
  }

  return (
    <Table aria-label="원생 목록">
      <TableHeader>
        <TableRow>
          <TableHead>원생</TableHead>
          <TableHead>선생님</TableHead>
          <TableHead>악기</TableHead>
          <TableHead>정기 요일</TableHead>
          <TableHead className="text-right">관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => (
          <TableRow key={student.studentId}>
            <TableCell label="원생" className="font-medium">
              {student.name}
            </TableCell>
            <TableCell label="선생님">
              {formatJoinedValue(student.teacherNames)}
            </TableCell>
            <TableCell label="악기">
              {formatJoinedValue(student.instrumentNames)}
            </TableCell>
            <TableCell label="정기 요일">
              {formatJoinedValue(student.weekdayLabels)}
            </TableCell>
            <TableCell label="관리" className="text-right">
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
  );
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
  return STUDENT_LESSON_TYPE_LABELS[lessonType === "private" ? "private" : "academy"];
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatAge(age: number | undefined) {
  return age === undefined ? "-" : `${age}세`;
}

function formatReferralDiscount(instrument: StudentListInstrument) {
  const referral = STUDENT_DISCOUNTS.find((discount) => discount.kind === "referral");

  return `${instrument.referralDiscountMonth} 한 달 -${formatWon(
    instrument.referralDiscountAmount ?? referral?.amount ?? 0,
  )}`;
}
