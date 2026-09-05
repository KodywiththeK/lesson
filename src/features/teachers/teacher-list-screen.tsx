"use client";

import { useMemo, useState } from "react";
import {
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
import type { ListView } from "@/domain/common-list";
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
import {
  createTeacherListQueryOptions,
  deleteResignedTeacher as deleteResignedTeacherApi,
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

type TeacherListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: TeacherListQueryOptionsFactory;
  registerTeacher?: (input: DemoTeacherRegistrationInput) => void | Promise<void>;
  updateTeacher?: (input: DemoTeacherUpdateInput) => void | Promise<void>;
  updateTeacherStatus?: (input: DemoTeacherStatusInput) => void | Promise<void>;
  deleteTeacher?: (input: {
    academyId: string;
    teacherId: string;
  }) => void | Promise<void>;
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

const teacherStatusOptions: Array<{
  value: TeacherStatus;
  label: string;
}> = [
  { value: "employed", label: formatTeacherStatus("employed") },
  { value: "on_leave", label: formatTeacherStatus("on_leave") },
  { value: "resigned", label: formatTeacherStatus("resigned") },
];

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
  registerTeacher,
  updateTeacher,
  updateTeacherStatus,
  deleteTeacher,
}: TeacherListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [part, setPart] = useState("");
  const [payType, setPayType] = useState<TeacherPayType | "">("");
  const [status, setStatus] = useState<TeacherStatus | "">("");
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
      status: status || undefined,
    },
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
  });

  const invalidateTeachers = () =>
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.academy(academyId), "teachers"],
    });

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
      toast.error(error instanceof Error ? error.message : String(error));
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
      toast.error(error instanceof Error ? error.message : String(error));
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
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "status-management"],
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : String(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { academyId: string; teacherId: string }) => {
      if (deleteTeacher) {
        await deleteTeacher(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await deleteResignedTeacherApi(supabaseClientState.client, input);
    },
    onSuccess: () => {
      setSelectedTeacher(null);
      toast.success("퇴사 선생님을 삭제했습니다.");
      void invalidateTeachers();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : String(error));
    },
  });

  const teachers = teacherListQuery.data?.items ?? [];
  const filterOptions = buildFilterOptions(teacherListQuery.data?.items ?? []);
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
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_10rem_10rem_10rem_auto]">
          <ListSearchField
            label="선생님 검색"
            value={search}
            onChange={setSearch}
            placeholder="이름, 담당 파트, 연락처, 급여"
          />

          <ListFilterSelect
            label="담당 파트 필터"
            value={part}
            options={filterOptions.parts}
            onChange={setPart}
          />
          <ListFilterSelect
            label="급여 형태 필터"
            value={payType}
            options={teacherPayTypeOptions}
            onChange={(nextPayType) =>
              setPayType(nextPayType as TeacherPayType | "")
            }
          />
          <ListFilterSelect
            label="상태 필터"
            value={status}
            options={teacherStatusOptions}
            onChange={(nextStatus) =>
              setStatus(nextStatus as TeacherStatus | "")
            }
          />

          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setPart("");
              setPayType("");
              setStatus("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 선생님 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {teacherListQuery.isError ? (
          <ListStatusAlert
            message="선생님 목록을 불러오지 못했습니다."
            detail={teacherListQuery.error.message}
          />
        ) : null}

        {teacherListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            선생님 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!teacherListQuery.isLoading &&
        !teacherListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <TeacherListTable
            teachers={teachers}
            onSelectTeacher={(teacher) => {
              setSelectedTeacher(teacher);
              setIsEditingSelectedTeacher(false);
            }}
          />
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
                isDeletePending={deleteMutation.isPending}
                onEdit={() => setIsEditingSelectedTeacher(true)}
                onChangeStatus={(nextStatus, reason) => {
                  statusMutation.mutate({
                    academyId,
                    teacherId: selectedTeacher.teacherId,
                    status: nextStatus,
                    reason,
                  });
                }}
                onDelete={() => {
                  if (selectedTeacher.status !== "resigned") {
                    return;
                  }

                  if (confirm(`${selectedTeacher.name} 선생님을 삭제할까요?`)) {
                    deleteMutation.mutate({
                      academyId,
                      teacherId: selectedTeacher.teacherId,
                    });
                  }
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
    initialTeacher?.registeredAt ?? getTodayDateString(),
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
          <span>계약 시작일</span>
          <Input
            aria-label="계약 시작일"
            type="date"
            value={contractStartOn}
            onChange={(event) => setContractStartOn(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>계약 종료일</span>
          <Input
            aria-label="계약 종료일"
            type="date"
            value={contractEndOn}
            onChange={(event) => setContractEndOn(event.target.value)}
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
              <Input
                aria-label={`${schedule.label} 시작 시간`}
                type="time"
                value={schedule.startTime}
                disabled={!schedule.checked}
                onChange={(event) => {
                  setWorkSchedules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, startTime: event.target.value }
                        : item,
                    ),
                  );
                }}
              />
              <Input
                aria-label={`${schedule.label} 종료 시간`}
                type="time"
                value={schedule.endTime}
                disabled={!schedule.checked}
                onChange={(event) => {
                  setWorkSchedules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, endTime: event.target.value }
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
  isDeletePending,
  onEdit,
  onChangeStatus,
  onDelete,
}: {
  teacher: TeacherListRow;
  isStatusPending: boolean;
  isDeletePending: boolean;
  onEdit: () => void;
  onChangeStatus: (status: TeacherStatus, reason?: string) => void;
  onDelete: () => void;
}) {
  const currentStatus = teacher.status ?? "employed";

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
        <Button
          type="button"
          variant="destructive"
          disabled={currentStatus !== "resigned" || isDeletePending}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" />
          삭제
        </Button>
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
            {nextLabel}로 변경합니다. 퇴사는 30일 보관 후 자동 archive
            처리됩니다.
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

function buildFilterOptions(teachers: TeacherListRow[]) {
  return {
    parts: uniqueSorted(teachers.map((teacher) => teacher.part)),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "ko"),
  );
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

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
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
