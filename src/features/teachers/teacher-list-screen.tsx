"use client";

import { useMemo, useState } from "react";
import {
  keepPreviousData,
  skipToken,
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
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { compareKoreanNames, type ListView } from "@/domain/common-list";
import type {
  BuildTeacherListOptions,
  TeacherListRow,
} from "@/domain/teacher-list";
import {
  formatTeacherSalarySummary,
  formatTeacherStatus,
  formatTeacherWorkScheduleSummary,
} from "@/domain/teacher-list";
import type { TeacherPayType } from "@/domain/teacher";
import { normalizeWorkSchedules } from "@/domain/teacher";
import { maskResidentRegistration } from "@/domain/teacher-resident-registration";
import { invalidateAfterPeopleChange } from "@/lib/api/query-invalidation";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  createTeacherListQueryOptions,
  createTeacherOptionsQueryOptions,
  registerTeacher as registerTeacherApi,
  ResidentRegistrationSaveError,
  revealTeacherResidentRegistration as revealTeacherResidentRegistrationApi,
  updateTeacherProfile as updateTeacherProfileApi,
  updateTeacherStatus as updateTeacherStatusApi,
  type RegisterTeacherInput,
  type RevealTeacherResidentRegistrationInput,
  type TeacherMutationSupabaseClient,
  type TeacherListSupabaseClient,
  type UpdateTeacherProfileInput,
} from "@/lib/api/teachers";
import { queryKeys } from "@/lib/api/query-keys";
import type { DemoTeacherStatusInput } from "@/lib/demo/academy-demo-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { TeacherDetail } from "./teacher-detail";
import { TeacherListTable } from "./teacher-list-table";
import {
  TeacherProfileForm,
  teacherPayTypeOptions,
  toWeekdayLabel,
  type TeacherFormInput,
} from "./teacher-profile-form";

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
  /** 급여 설정·주민등록번호 입력과 원문 보기는 원장만 쓴다. 보안 경계는 서버(RLS·RPC)이고 이 값은 표시 편의다. */
  isOwner?: boolean;
  queryOptionsFactory?: TeacherListQueryOptionsFactory;
  teacherOptionsQueryOptions?: TeacherOptionsQueryOptions;
  // 데모 상태(`src/lib/demo`)는 원장 컨텍스트 전용이라 급여가 필수인 좁은 입력을 받는다. 메서드 문법으로 선언해 그 핸들러를 받는다.
  registerTeacher?(input: TeacherFormInput): void | Promise<void>;
  updateTeacher?(input: TeacherFormInput & { academyId: string; teacherId: string }): void | Promise<void>;
  updateTeacherStatus?: (input: DemoTeacherStatusInput) => void | Promise<void>;
  revealResidentRegistration?: (input: RevealTeacherResidentRegistrationInput) => Promise<string>;
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

export function TeacherListScreen({
  academyId,
  isOwner = false,
  queryOptionsFactory,
  teacherOptionsQueryOptions,
  registerTeacher,
  updateTeacher,
  updateTeacherStatus,
  revealResidentRegistration,
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
      // 프로필은 이미 등록됐으므로 다이얼로그를 닫고 목록을 새로 읽어 같은 선생님을 다시 등록하지 않게 한다.
      if (error instanceof ResidentRegistrationSaveError) {
        setIsRegistrationOpen(false);
        void invalidateTeachers();
      }

      toast.error(
        error instanceof ResidentRegistrationSaveError
          ? "주민등록번호를 저장하지 못했습니다."
          : "선생님 등록에 실패했습니다.",
        { description: toUserMessage(error) },
      );
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
      showUpdatedTeacher(input);
      toast.success("선생님 정보를 수정했습니다.");
      void invalidateTeachers();
    },
    onError: (error, input) => {
      // 프로필 수정은 끝나고 주민등록번호 저장만 실패한 경우: 수정된 정보를 보여 주고 번호만 다시 입력하게 안내한다.
      if (error instanceof ResidentRegistrationSaveError) {
        showUpdatedTeacher(input);
        void invalidateTeachers();
      }

      toast.error(
        error instanceof ResidentRegistrationSaveError
          ? "주민등록번호를 저장하지 못했습니다."
          : "선생님 정보 수정에 실패했습니다.",
        { description: toUserMessage(error) },
      );
    },
  });

  function showUpdatedTeacher(input: UpdateTeacherProfileInput) {
    setSelectedTeacher((teacher) =>
      teacher?.teacherId === input.teacherId
        ? buildUpdatedTeacherSnapshot(teacher, input)
        : teacher,
    );
    setIsEditingSelectedTeacher(false);
  }

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

  async function revealResidentRegistrationFor(teacherId: string) {
    const input = { academyId, teacherId };

    if (revealResidentRegistration) {
      return revealResidentRegistration(input);
    }

    if (!supabaseClientState?.client) {
      throw new Error("Supabase client 상태를 만들지 못했습니다.");
    }

    return revealTeacherResidentRegistrationApi(supabaseClientState.client, input);
  }

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
              {isOwner
                ? "계약기간, 근무시간, 급여 상세를 함께 등록합니다."
                : "계약기간과 근무시간을 함께 등록합니다. 급여 설정은 원장이 등록합니다."}
            </DialogDescription>
          </DialogHeader>
          <TeacherProfileForm
            submitLabel="저장"
            isOwner={isOwner}
            isSubmitting={registerMutation.isPending}
            onSubmit={(input) => {
              registerMutation.mutate(input);
            }}
          />
        </DialogContent>
      </Dialog>
    ),
    [isOwner, isRegistrationOpen, registerMutation],
  );
  const isHeaderActionMounted = usePageHeaderActions(registrationAction);

  return (
    <section className="grid gap-4" aria-label="선생님 목록">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {registrationAction}
      </PageHeaderActionFallback>

      <SectionCard padded={false}>
        <div
          className={
            isOwner
              ? "grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto]"
              : "grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_10rem_auto]"
          }
        >
          <ListSearchField
            label="선생님 검색"
            value={search}
            onChange={(nextSearch) => {
              setSearch(nextSearch);
              resetPage();
            }}
            placeholder={isOwner ? "이름, 담당 파트, 연락처, 급여" : "이름, 담당 파트, 연락처"}
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
          {isOwner ? (
            <ListFilterSelect
              label="급여 형태 필터"
              value={payType}
              options={teacherPayTypeOptions}
              onChange={(nextPayType) => {
                setPayType(nextPayType as TeacherPayType | "");
                resetPage();
              }}
            />
          ) : null}

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
          <EmptyState>
            선생님 목록을 불러오는 중입니다.
          </EmptyState>
        ) : null}

        {teacherListView ? (
          <>
            <TeacherListTable
              teachers={teachers}
              isOwner={isOwner}
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
      </SectionCard>

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
                {isOwner
                  ? "선생님 기본정보, 계약, 근무시간, 급여정보를 확인합니다."
                  : "선생님 기본정보, 계약, 근무시간을 확인합니다."}
              </DialogDescription>
            </DialogHeader>
            {isEditingSelectedTeacher ? (
              <TeacherProfileForm
                initialTeacher={selectedTeacher}
                isOwner={isOwner}
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
                isOwner={isOwner}
                isStatusPending={statusMutation.isPending}
                onEdit={() => setIsEditingSelectedTeacher(true)}
                onRevealResidentRegistration={() =>
                  revealResidentRegistrationFor(selectedTeacher.teacherId)
                }
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

/** 선택한 파트는 선택지에서 빠지지 않게 항상 포함한다. */
function buildPartOptions(teachers: TeacherListRow[], selectedPart: string) {
  const parts = [...teachers.map((teacher) => teacher.part), selectedPart];

  return [...new Set(parts.filter(Boolean))].sort(compareKoreanNames);
}

function buildUpdatedTeacherSnapshot(
  current: TeacherListRow,
  input: UpdateTeacherProfileInput,
): TeacherListRow {
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
    workSchedules,
    residentRegistrationMasked:
      maskResidentRegistration(input.residentRegistration ?? "") || current.residentRegistrationMasked,
    ...buildUpdatedSalaryFields(current, input),
  };

  return {
    ...updated,
    workScheduleSummary: formatTeacherWorkScheduleSummary(workSchedules),
  };
}

/** 급여 항목 없이 저장한 수정(원장이 아닌 사용자)은 급여 관련 값을 그대로 둔다. */
function buildUpdatedSalaryFields(current: TeacherListRow, input: UpdateTeacherProfileInput) {
  if (!input.payType) {
    return {
      payType: current.payType,
      monthlySalary: current.monthlySalary,
      hourlyRate: current.hourlyRate,
      ratioTeacherShare: current.ratioTeacherShare,
      salarySummary: current.salarySummary,
    };
  }

  const salary = {
    payType: input.payType,
    monthlySalary: input.payType === "monthly" ? input.monthlySalary : undefined,
    hourlyRate: input.payType === "hourly" ? input.hourlyRate : undefined,
    ratioTeacherShare:
      input.payType === "ratio" && input.ratioTeacherShare !== undefined
        ? input.ratioTeacherShare * 10
        : undefined,
  };

  return { ...salary, salarySummary: formatTeacherSalarySummary(salary) };
}
