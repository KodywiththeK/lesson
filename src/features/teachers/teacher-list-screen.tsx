"use client";

import { useId, useMemo, useState } from "react";
import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  Eye,
  Pencil,
  RotateCcw,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
import { DateField, TimeField } from "@/components/operations/date-time-fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { compareKoreanNames, type ListView } from "@/domain/common-list";
import type {
  BuildTeacherListOptions,
  TeacherListRow,
} from "@/domain/teacher-list";
import {
  formatTeacherPayType,
  formatTeacherSalarySummary,
  formatTeacherStatus,
  formatTeacherWorkScheduleSummary,
} from "@/domain/teacher-list";
import type {
  TeacherPayType,
  TeacherStatus,
  TeacherWorkScheduleInput,
} from "@/domain/teacher";
import { normalizeWorkSchedules } from "@/domain/teacher";
import { getFinanceToday } from "@/domain/finance-date";
import { invalidateAfterPeopleChange } from "@/lib/api/query-invalidation";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  createTeacherListQueryOptions,
  createTeacherOptionsQueryOptions,
  registerTeacher as registerTeacherApi,
  updateTeacherProfile as updateTeacherProfileApi,
  updateTeacherStatus as updateTeacherStatusApi,
  type RegisterTeacherInput,
  type TeacherMutationSupabaseClient,
  type TeacherListSupabaseClient,
  type UpdateTeacherProfileInput,
} from "@/lib/api/teachers";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  DemoTeacherRegistrationInput,
  DemoTeacherStatusInput,
  DemoTeacherUpdateInput,
} from "@/lib/demo/academy-demo-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TeacherListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<TeacherListRow>>;
};

export type TeacherListQueryOptionsFactory = (
  options: BuildTeacherListOptions,
) => TeacherListQueryOptions;

/** 페이지로 자르지 않은 재직 선생님 전체. 담당 파트 필터 선택지를 만든다. */
export type TeacherOptionsQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<TeacherListRow[]>;
};

type TeacherListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: TeacherListQueryOptionsFactory;
  teacherOptionsQueryOptions?: TeacherOptionsQueryOptions;
  registerTeacher?: (input: DemoTeacherRegistrationInput) => void | Promise<void>;
  updateTeacher?: (input: DemoTeacherUpdateInput) => void | Promise<void>;
  updateTeacherStatus?: (input: DemoTeacherStatusInput) => void | Promise<void>;
};

type TeacherSupabaseClient = TeacherListSupabaseClient &
  TeacherMutationSupabaseClient;

type SupabaseClientState =
  | {
      client: TeacherSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

type TeacherFormInput = DemoTeacherRegistrationInput;

const teacherPayTypeOptions: Array<{
  value: TeacherPayType;
  label: string;
}> = [
  { value: "monthly", label: formatTeacherPayType("monthly") },
  { value: "hourly", label: formatTeacherPayType("hourly") },
  { value: "ratio", label: formatTeacherPayType("ratio") },
];

const TEACHER_DELETE_BLOCKED_MESSAGE =
  "결제·회차권·급여 기록을 보존하기 위해 삭제할 수 없습니다. 보관 상태로 유지됩니다.";

const weekdayOptions = [
  { value: "monday", label: "월" },
  { value: "tuesday", label: "화" },
  { value: "wednesday", label: "수" },
  { value: "thursday", label: "목" },
  { value: "friday", label: "금" },
  { value: "saturday", label: "토" },
  { value: "sunday", label: "일" },
];

export function TeacherListScreen({
  academyId,
  queryOptionsFactory,
  teacherOptionsQueryOptions,
  registerTeacher,
  updateTeacher,
  updateTeacherStatus,
}: TeacherListScreenProps) {
  const queryClient = useQueryClient();
  const { page, pageSize, goToPage, changePageSize, resetPage } =
    useListPaging();
  const [search, setSearch] = useState("");
  const [part, setPart] = useState("");
  const [payType, setPayType] = useState<TeacherPayType | "">("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherListRow | null>(
    null,
  );
  const [isEditingSelectedTeacher, setIsEditingSelectedTeacher] =
    useState(false);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createTeacherListSupabaseClient()),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildTeacherListOptions = {
    academyId,
    search,
    filters: {
      part: part || undefined,
      payType: payType || undefined,
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
  const teacherListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
    placeholderData: keepPreviousData,
  });
  const partOptionsQueryOptions =
    teacherOptionsQueryOptions ??
    (supabaseClientState?.client
      ? createTeacherOptionsQueryOptions(supabaseClientState.client, academyId)
      : undefined);
  const teacherOptionsQuery = useQuery({
    queryKey:
      partOptionsQueryOptions?.queryKey ?? queryKeys.teachers.options(academyId),
    queryFn: partOptionsQueryOptions?.queryFn ?? skipToken,
  });

  const invalidateTeachers = () => invalidateAfterPeopleChange(queryClient, academyId);

  const registerMutation = useMutation({
    mutationFn: async (input: TeacherFormInput) => {
      if (registerTeacher) {
        await registerTeacher(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await registerTeacherApi(supabaseClientState.client, {
        academyId,
        ...input,
      } satisfies RegisterTeacherInput);
    },
    onSuccess: () => {
      setIsRegistrationOpen(false);
      toast.success("선생님을 등록했습니다.");
      void invalidateTeachers();
    },
    onError: (error) => {
      toast.error("선생님 등록에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateTeacherProfileInput) => {
      if (updateTeacher) {
        await updateTeacher(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await updateTeacherProfileApi(supabaseClientState.client, input);
    },
    onSuccess: (_, input) => {
      setSelectedTeacher((teacher) =>
        teacher?.teacherId === input.teacherId
          ? buildUpdatedTeacherSnapshot(teacher, input)
          : teacher,
      );
      setIsEditingSelectedTeacher(false);
      toast.success("선생님 정보를 수정했습니다.");
      void invalidateTeachers();
    },
    onError: (error) => {
      toast.error("선생님 정보 수정에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (input: DemoTeacherStatusInput) => {
      if (updateTeacherStatus) {
        await updateTeacherStatus(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await updateTeacherStatusApi(supabaseClientState.client, {
        ...input,
        changedAt: new Date().toISOString(),
      });
    },
    onSuccess: (_, input) => {
      setSelectedTeacher((teacher) =>
        teacher?.teacherId === input.teacherId
          ? {
              ...teacher,
              status: input.status,
            }
          : teacher,
      );
      toast.success(`선생님 상태를 ${formatTeacherStatus(input.status)}로 변경했습니다.`);
      void invalidateTeachers();
    },
    onError: (error) => {
      toast.error("선생님 상태 변경에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  const supabaseConfigError = hasInjectedQueryOptions
    ? null
    : (supabaseClientState?.error ?? null);
  const teacherListView =
    supabaseConfigError || teacherListQuery.isError
      ? undefined
      : teacherListQuery.data;
  const teachers = teacherListView?.items ?? [];
  const partOptions = buildPartOptions(
    teacherOptionsQuery.data ?? teachers,
    part,
  );
  const registrationAction = useMemo(
    () => (
      <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
        <DialogTrigger asChild>
          <Button type="button">
            <UserPlus aria-hidden="true" />
            선생님 등록
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>선생님 등록</DialogTitle>
            <DialogDescription>
              계약기간, 근무시간, 급여 상세를 함께 등록합니다.
            </DialogDescription>
          </DialogHeader>
          <TeacherProfileForm
            submitLabel="저장"
            isSubmitting={registerMutation.isPending}
            onSubmit={(input) => {
              registerMutation.mutate(input);
            }}
          />
        </DialogContent>
      </Dialog>
    ),
    [isRegistrationOpen, registerMutation],
  );
  const isHeaderActionMounted = usePageHeaderActions(registrationAction);

  return (
    <section className="grid gap-4" aria-label="선생님 목록">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {registrationAction}
      </PageHeaderActionFallback>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto]">
          <ListSearchField
            label="선생님 검색"
            value={search}
            onChange={(nextSearch) => {
              setSearch(nextSearch);
              resetPage();
            }}
            placeholder="이름, 담당 파트, 연락처, 급여"
          />

          <ListFilterSelect
            label="담당 파트 필터"
            value={part}
            options={partOptions}
            onChange={(nextPart) => {
              setPart(nextPart);
              resetPage();
            }}
          />
          <ListFilterSelect
            label="급여 형태 필터"
            value={payType}
            options={teacherPayTypeOptions}
            onChange={(nextPayType) => {
              setPayType(nextPayType as TeacherPayType | "");
              resetPage();
            }}
          />

          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setPart("");
              setPayType("");
              resetPage();
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {supabaseConfigError ? (
          <ListStatusAlert
            message="선생님 목록을 불러오지 못했습니다."
            detail={toUserMessage(supabaseConfigError)}
          />
        ) : null}

        {teacherListQuery.isError ? (
          <ListStatusAlert
            message="선생님 목록을 불러오지 못했습니다."
            detail={toUserMessage(teacherListQuery.error)}
          />
        ) : null}

        {teacherListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            선생님 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {teacherListView ? (
          <>
            <TeacherListTable
              teachers={teachers}
              onSelectTeacher={(teacher) => {
                setSelectedTeacher(teacher);
                setIsEditingSelectedTeacher(false);
              }}
            />
            <ListPagination
              itemLabel="선생님"
              countUnit="명"
              view={teacherListView}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : null}
      </div>

      <Dialog
        open={Boolean(selectedTeacher)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTeacher(null);
            setIsEditingSelectedTeacher(false);
          }
        }}
      >
        {selectedTeacher ? (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedTeacher.name} 상세</DialogTitle>
              <DialogDescription>
                선생님 기본정보, 계약, 근무시간, 급여정보를 확인합니다.
              </DialogDescription>
            </DialogHeader>
            {isEditingSelectedTeacher ? (
              <TeacherProfileForm
                initialTeacher={selectedTeacher}
                submitLabel="수정완료"
                isSubmitting={updateMutation.isPending}
                onSubmit={(input) => {
                  updateMutation.mutate({
                    academyId,
                    teacherId: selectedTeacher.teacherId,
                    ...input,
                  });
                }}
              />
            ) : (
              <TeacherDetail
                teacher={selectedTeacher}
                isStatusPending={statusMutation.isPending}
                onEdit={() => setIsEditingSelectedTeacher(true)}
                onChangeStatus={(nextStatus, reason) => {
                  statusMutation.mutate({
                    academyId,
                    teacherId: selectedTeacher.teacherId,
                    status: nextStatus,
                    reason,
                  });
                }}
              />
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function TeacherProfileForm({
  initialTeacher,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  initialTeacher?: TeacherListRow;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (input: TeacherFormInput) => void;
}) {
  const initialSalary = getInitialSalaryState(initialTeacher);
  const [name, setName] = useState(initialTeacher?.name ?? "");
  const [part, setPart] = useState(initialTeacher?.part ?? "피아노");
  const [contact, setContact] = useState(initialTeacher?.contact ?? "");
  const [registeredAt, setRegisteredAt] = useState(
    initialTeacher?.registeredAt ?? getFinanceToday(),
  );
  const [contractStartOn, setContractStartOn] = useState(
    initialTeacher?.contractStartOn ?? "",
  );
  const [contractEndOn, setContractEndOn] = useState(
    initialTeacher?.contractEndOn ?? "",
  );
  const [payType, setPayType] = useState<TeacherPayType>(
    initialTeacher?.payType ?? "monthly",
  );
  const [monthlySalary, setMonthlySalary] = useState(initialSalary.monthlySalary);
  const [hourlyRate, setHourlyRate] = useState(initialSalary.hourlyRate);
  const [ratioAcademyShare, setRatioAcademyShare] = useState(
    initialSalary.ratioAcademyShare,
  );
  const [ratioTeacherShare, setRatioTeacherShare] = useState(
    initialSalary.ratioTeacherShare,
  );
  const [workSchedules, setWorkSchedules] = useState(() =>
    buildInitialWorkScheduleState(initialTeacher),
  );
  const ratioTotal =
    Number(ratioAcademyShare || 0) + Number(ratioTeacherShare || 0);
  const canSubmit =
    Boolean(
      name.trim() &&
        part.trim() &&
        contact.trim() &&
        registeredAt &&
        contractStartOn &&
        contractEndOn,
    ) &&
    (payType !== "ratio" || ratioTotal === 10);

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        const selectedSchedules = workSchedules
          .filter((schedule) => schedule.checked)
          .map(
            (schedule): TeacherWorkScheduleInput => ({
              weekday: schedule.weekday,
              ...(schedule.startTime ? { startTime: schedule.startTime } : {}),
              ...(schedule.endTime ? { endTime: schedule.endTime } : {}),
            }),
          );

        onSubmit({
          name: name.trim(),
          part: part.trim(),
          contact: contact.trim(),
          registeredAt,
          contractStartOn,
          contractEndOn,
          payType,
          monthlySalary:
            payType === "monthly" ? Number(monthlySalary || 0) : undefined,
          hourlyRate: payType === "hourly" ? Number(hourlyRate || 0) : undefined,
          ratioAcademyShare:
            payType === "ratio" ? Number(ratioAcademyShare || 0) : undefined,
          ratioTeacherShare:
            payType === "ratio" ? Number(ratioTeacherShare || 0) : undefined,
          workSchedules: selectedSchedules,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>선생님명</span>
          <Input
            aria-label="선생님명"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>담당 파트</span>
          <Input
            aria-label="담당 파트"
            value={part}
            onChange={(event) => setPart(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>연락처</span>
          <Input
            aria-label="연락처"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>등록일</span>
          <DateField
            aria-label="등록일"
            value={registeredAt}
            onValueChange={setRegisteredAt}
          />
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>계약 시작일</span>
          <DateField
            aria-label="계약 시작일"
            value={contractStartOn}
            onValueChange={setContractStartOn}
          />
        </Label>
        <Label className="grid gap-1">
          <span>계약 종료일</span>
          <DateField
            aria-label="계약 종료일"
            value={contractEndOn}
            onValueChange={setContractEndOn}
          />
        </Label>
      </div>

      <div className="grid gap-3">
        <Label>출근 요일</Label>
        <div className="grid gap-2 rounded-md border border-border p-3">
          {workSchedules.map((schedule, index) => (
            <div
              key={schedule.weekday}
              className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr]"
            >
              <Label className="flex items-center gap-2">
                <Checkbox
                  aria-label={schedule.label}
                  checked={schedule.checked}
                  onCheckedChange={(checked) => {
                    setWorkSchedules((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, checked: checked === true }
                          : item,
                      ),
                    );
                  }}
                />
                <span>{schedule.label}</span>
              </Label>
              <TimeField
                aria-label={`${schedule.label} 시작 시간`}
                value={schedule.startTime}
                disabled={!schedule.checked}
                onValueChange={(nextValue) => {
                  setWorkSchedules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, startTime: nextValue }
                        : item,
                    ),
                  );
                }}
              />
              <TimeField
                aria-label={`${schedule.label} 종료 시간`}
                value={schedule.endTime}
                disabled={!schedule.checked}
                onValueChange={(nextValue) => {
                  setWorkSchedules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, endTime: nextValue }
                        : item,
                    ),
                  );
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <Label className="grid gap-1">
          <span>급여 형태</span>
          <NativeSelect
            aria-label="급여 형태"
            value={payType}
            onChange={(event) => setPayType(event.target.value as TeacherPayType)}
          >
            {teacherPayTypeOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        {payType === "monthly" ? (
          <Label className="grid gap-1">
            <span>월급</span>
            <Input
              aria-label="월급"
              type="number"
              min="0"
              value={monthlySalary}
              onChange={(event) => setMonthlySalary(event.target.value)}
            />
          </Label>
        ) : null}
        {payType === "hourly" ? (
          <Label className="grid gap-1">
            <span>시급</span>
            <Input
              aria-label="시급"
              type="number"
              min="0"
              value={hourlyRate}
              onChange={(event) => setHourlyRate(event.target.value)}
            />
          </Label>
        ) : null}
        {payType === "ratio" ? (
          <div className="grid gap-2">
            <Label>비율 설정 (학원 : 선생님, 합계 10)</Label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <Input
                aria-label="학원 몫"
                type="number"
                min="0"
                max="10"
                value={ratioAcademyShare}
                onChange={(event) => setRatioAcademyShare(event.target.value)}
              />
              <span className="text-muted-foreground">:</span>
              <Input
                aria-label="선생님 몫"
                type="number"
                min="0"
                max="10"
                value={ratioTeacherShare}
                onChange={(event) => setRatioTeacherShare(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">현재 합계 {ratioTotal}</p>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TeacherDetail({
  teacher,
  isStatusPending,
  onEdit,
  onChangeStatus,
}: {
  teacher: TeacherListRow;
  isStatusPending: boolean;
  onEdit: () => void;
  onChangeStatus: (status: TeacherStatus, reason?: string) => void;
}) {
  const currentStatus = teacher.status ?? "employed";
  const deleteGuidanceId = useId();

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoField label="상태" value={formatTeacherStatus(currentStatus)} />
        <InfoField label="담당 파트" value={teacher.part} />
        <InfoField label="연락처" value={teacher.contact || "-"} />
        <InfoField label="등록일" value={teacher.registeredAt} />
        <InfoField
          label="계약기간"
          value={`${teacher.contractStartOn ?? "-"} - ${
            teacher.contractEndOn ?? "-"
          }`}
        />
        <InfoField label="급여정보" value={teacher.salarySummary ?? "-"} />
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-medium">근무시간</h3>
        <div className="flex flex-wrap gap-2">
          {teacher.workSchedules && teacher.workSchedules.length > 0 ? (
            teacher.workSchedules.map((schedule) => (
              <Badge key={schedule.scheduleId ?? schedule.weekday} variant="outline">
                {schedule.startTime && schedule.endTime
                  ? `${schedule.weekdayLabel} ${schedule.startTime}-${schedule.endTime}`
                  : schedule.weekdayLabel}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            수정하기
          </Button>
          <TeacherStatusConfirmButton
            teacher={teacher}
            nextStatus="on_leave"
            disabled={isStatusPending || currentStatus === "on_leave"}
            onConfirm={onChangeStatus}
          />
          <TeacherStatusConfirmButton
            teacher={teacher}
            nextStatus="resigned"
            disabled={isStatusPending || currentStatus === "resigned"}
            onConfirm={onChangeStatus}
          />
        </div>
        <div className="grid gap-1 sm:max-w-xs sm:justify-items-end">
          <Button
            type="button"
            variant="destructive"
            disabled
            aria-describedby={deleteGuidanceId}
          >
            <Trash2 aria-hidden="true" />
            삭제
          </Button>
          <p
            id={deleteGuidanceId}
            className="text-xs text-muted-foreground sm:text-right"
          >
            {TEACHER_DELETE_BLOCKED_MESSAGE}
          </p>
        </div>
      </DialogFooter>
    </div>
  );
}

function TeacherStatusConfirmButton({
  teacher,
  nextStatus,
  disabled,
  onConfirm,
}: {
  teacher: TeacherListRow;
  nextStatus: "on_leave" | "resigned";
  disabled: boolean;
  onConfirm: (status: TeacherStatus, reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const currentStatus = teacher.status ?? "employed";
  const nextLabel = formatTeacherStatus(nextStatus);
  const Icon = nextStatus === "on_leave" ? UserMinus : UserCheck;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <Icon aria-hidden="true" />
          {nextLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>상태 변경 확인</AlertDialogTitle>
          <AlertDialogDescription>
            {teacher.name} 선생님 상태를 {formatTeacherStatus(currentStatus)}에서{" "}
            {nextLabel}로 변경합니다. 퇴사는 30일 보관 후 자동으로
            보관 처리됩니다.
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
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm(nextStatus, reason.trim() || undefined);
              setReason("");
            }}
          >
            처리
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border border-border p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function createDefaultQueryOptions(
  options: BuildTeacherListOptions,
  supabaseClientState: SupabaseClientState,
): TeacherListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.teachers.list(options.academyId, {
        q: options.search,
        part: options.filters?.part,
        payType: options.filters?.payType,
        status: options.filters?.status,
        page: String(options.page ?? 1),
        pageSize: String(options.pageSize ?? ""),
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createTeacherListQueryOptions(supabaseClientState.client, options);
}

function createTeacherListSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as TeacherSupabaseClient,
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

function TeacherListTable({
  teachers,
  onSelectTeacher,
}: {
  teachers: TeacherListRow[];
  onSelectTeacher: (teacher: TeacherListRow) => void;
}) {
  if (teachers.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 선생님이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="선생님 목록" className="min-w-[72rem]">
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">선생님</TableHead>
            <TableHead className="px-4 py-3">상태</TableHead>
            <TableHead className="px-4 py-3">담당 파트</TableHead>
            <TableHead className="px-4 py-3">연락처</TableHead>
            <TableHead className="px-4 py-3">계약기간</TableHead>
            <TableHead className="px-4 py-3">근무시간</TableHead>
            <TableHead className="px-4 py-3">급여</TableHead>
            <TableHead className="px-4 py-3 text-right">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => {
            const currentStatus = teacher.status ?? "employed";

            return (
              <TableRow key={teacher.teacherId}>
                <TableCell className="px-4 py-3 font-medium">
                  {teacher.name}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Badge variant={currentStatus === "employed" ? "default" : "outline"}>
                    {formatTeacherStatus(currentStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3">{teacher.part}</TableCell>
                <TableCell className="px-4 py-3">
                  {teacher.contact || "-"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {teacher.contractStartOn && teacher.contractEndOn
                    ? `${teacher.contractStartOn} - ${teacher.contractEndOn}`
                    : "-"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {teacher.workScheduleSummary ?? "-"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {teacher.salarySummary ?? formatTeacherPayType(teacher.payType)}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${teacher.name} 자세히보기`}
                    onClick={() => onSelectTeacher(teacher)}
                  >
                    <Eye aria-hidden="true" />
                    자세히보기
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** 선택한 파트는 선택지에서 빠지지 않게 항상 포함한다. */
function buildPartOptions(teachers: TeacherListRow[], selectedPart: string) {
  const parts = [...teachers.map((teacher) => teacher.part), selectedPart];

  return [...new Set(parts.filter(Boolean))].sort(compareKoreanNames);
}

function buildInitialWorkScheduleState(teacher: TeacherListRow | undefined) {
  return weekdayOptions.map((weekday) => {
    const existing = teacher?.workSchedules?.find(
      (schedule) =>
        schedule.weekday === weekday.value ||
        schedule.weekdayLabel === weekday.label,
    );

    return {
      weekday: weekday.value,
      label: weekday.label,
      checked: Boolean(existing),
      startTime: existing?.startTime ?? "",
      endTime: existing?.endTime ?? "",
    };
  });
}

function getInitialSalaryState(teacher: TeacherListRow | undefined) {
  if (!teacher) {
    return {
      monthlySalary: "",
      hourlyRate: "",
      ratioAcademyShare: "4",
      ratioTeacherShare: "6",
    };
  }

  const teacherShare = teacher.ratioTeacherShare
    ? String(teacher.ratioTeacherShare / 10)
    : "6";

  return {
    monthlySalary: teacher.monthlySalary ? String(teacher.monthlySalary) : "",
    hourlyRate: teacher.hourlyRate ? String(teacher.hourlyRate) : "",
    ratioAcademyShare: String(10 - Number(teacherShare)),
    ratioTeacherShare: teacherShare,
  };
}


function buildUpdatedTeacherSnapshot(
  current: TeacherListRow,
  input: UpdateTeacherProfileInput,
): TeacherListRow {
  const salaryFields = {
    monthlySalary: input.payType === "monthly" ? input.monthlySalary : undefined,
    hourlyRate: input.payType === "hourly" ? input.hourlyRate : undefined,
    ratioTeacherShare:
      input.payType === "ratio" && input.ratioTeacherShare !== undefined
        ? input.ratioTeacherShare * 10
        : undefined,
  };
  const workSchedules = normalizeWorkSchedules(input.workSchedules ?? []).map(
    (schedule, index) => ({
      scheduleId: `${input.teacherId}-${schedule.weekday}-${index}`,
      weekday: schedule.weekday,
      weekdayLabel: toWeekdayLabel(schedule.weekday),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    }),
  );
  const updated: TeacherListRow = {
    ...current,
    name: input.name,
    part: input.part,
    contact: input.contact,
    registeredAt: input.registeredAt,
    contractStartOn: input.contractStartOn,
    contractEndOn: input.contractEndOn,
    payType: input.payType,
    workSchedules,
    ...salaryFields,
  };

  return {
    ...updated,
    salarySummary: formatTeacherSalarySummary(updated),
    workScheduleSummary: formatTeacherWorkScheduleSummary(workSchedules),
  };
}

function toWeekdayLabel(value: string) {
  return weekdayOptions.find((weekday) => weekday.value === value)?.label ?? value;
}
