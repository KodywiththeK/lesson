"use client";

import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { MessageSquarePlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import { Button } from "@/components/ui/button";
import type { ListView } from "@/domain/common-list";
import {
  CONSULTATION_INSTRUMENT_NAMES,
  toConsultationFormValues,
  type ConsultationProfile,
} from "@/domain/consultation";
import type {
  BuildConsultationListOptions,
  ConsultationListRow,
} from "@/domain/consultation-list";
import type { TeacherListRow } from "@/domain/teacher-list";
import {
  createConsultationListQueryKey,
  deleteConsultation as deleteConsultationApi,
  fetchConsultationList,
  registerConsultation as registerConsultationApi,
  updateConsultation as updateConsultationApi,
  type ConsultationListSupabaseClient,
  type ConsultationMutationSupabaseClient,
} from "@/lib/api/consultations";
import { invalidateAfterPeopleChange } from "@/lib/api/query-invalidation";
import { queryKeys } from "@/lib/api/query-keys";
import {
  registerStudentEnrollment,
  type StudentRegistrationSupabaseClient,
} from "@/lib/api/students";
import { fetchTeacherOptions, type TeacherListSupabaseClient } from "@/lib/api/teachers";
import type { DemoStudentRegistrationInput } from "@/lib/demo/academy-demo-state";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { StudentRegistrationDialog } from "../students/student-registration-dialog";
import { ConsultationDeleteDialog } from "./consultation-delete-dialog";
import { ConsultationFormDialog } from "./consultation-form-dialog";
import { ConsultationListTable } from "./consultation-list-table";

type ConsultationListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<ConsultationListRow>>;
};

export type ConsultationListQueryOptionsFactory = (
  options: BuildConsultationListOptions,
) => ConsultationListQueryOptions;

export type ConsultationUpdateInput = ConsultationProfile & { consultationId: string };

type ConsultationListScreenProps = {
  academyId: string;
  queryOptionsFactory?: ConsultationListQueryOptionsFactory;
  /** 원생 등록 폼의 담당 선생님 후보. 없으면 선생님 목록을 조회한다. */
  teachers?: TeacherListRow[];
  registerConsultation?: (input: ConsultationProfile) => void | Promise<void>;
  updateConsultation?: (input: ConsultationUpdateInput) => void | Promise<void>;
  deleteConsultation?: (input: { consultationId: string }) => void | Promise<void>;
  registerStudent?: (input: DemoStudentRegistrationInput) => void | Promise<void>;
};

type ConsultationSupabaseClient = ConsultationListSupabaseClient &
  ConsultationMutationSupabaseClient &
  StudentRegistrationSupabaseClient &
  TeacherListSupabaseClient;

type SupabaseClientState =
  | { client: ConsultationSupabaseClient; error: null }
  | { client: null; error: Error };

const NO_TEACHERS: TeacherListRow[] = [];

export function ConsultationListScreen({
  academyId,
  queryOptionsFactory,
  teachers,
  registerConsultation,
  updateConsultation,
  deleteConsultation,
  registerStudent,
}: ConsultationListScreenProps) {
  const queryClient = useQueryClient();
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const [search, setSearch] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<ConsultationListRow | null>(null);
  const [deletingConsultation, setDeletingConsultation] = useState<ConsultationListRow | null>(null);
  const [enrollingConsultation, setEnrollingConsultation] = useState<ConsultationListRow | null>(null);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createSupabaseClientState()),
    [hasInjectedQueryOptions],
  );
  const operations = createConsultationOperations(academyId, supabaseClientState, {
    registerConsultation,
    updateConsultation,
    deleteConsultation,
    registerStudent,
  });

  const currentOptions: BuildConsultationListOptions = {
    academyId,
    search,
    filters: { instrumentName: instrumentName || undefined },
    page,
    pageSize,
  };
  const queryOptions: ConsultationListQueryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : {
        queryKey: createConsultationListQueryKey(currentOptions),
        queryFn: () =>
          fetchConsultationList(requireSupabaseClient(supabaseClientState), currentOptions),
      };
  const consultationListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
    placeholderData: keepPreviousData,
  });
  const teacherOptionsQuery = useQuery({
    queryKey: queryKeys.teachers.options(academyId),
    queryFn: () => fetchTeacherOptions(requireSupabaseClient(supabaseClientState), academyId),
    enabled: !teachers && !hasInjectedQueryOptions && !supabaseClientState?.error,
  });
  const teacherOptions = teachers ?? teacherOptionsQuery.data ?? NO_TEACHERS;

  const registerMutation = useMutation({
    mutationFn: operations.register,
    onSuccess: () => {
      setIsRegistrationOpen(false);
      toast.success("상담을 등록했습니다.");
      void invalidateConsultations(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("상담 등록에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const updateMutation = useMutation({
    mutationFn: operations.update,
    onSuccess: () => {
      setEditingConsultation(null);
      toast.success("상담을 수정했습니다.");
      void invalidateConsultations(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("상담 수정에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: operations.remove,
    onSuccess: () => {
      setDeletingConsultation(null);
      toast.success("상담 기록을 삭제했습니다.");
      void invalidateConsultations(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("상담 기록 삭제에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const enrollMutation = useMutation({
    mutationFn: (request: EnrollmentRequest) =>
      registerStudentAndRemoveConsultation(operations, request),
    onSuccess: ({ consultationRemoval }) => {
      setEnrollingConsultation(null);
      invalidateAfterPeopleChange(queryClient, academyId);
      void invalidateConsultations(queryClient, academyId);

      if (consultationRemoval.removed) {
        toast.success("원생을 등록하고 상담 기록을 삭제했습니다.");
        return;
      }

      toast.warning(
        "원생은 등록했지만 상담 기록을 삭제하지 못했습니다. 상담 목록에서 직접 삭제해 주세요.",
        { description: toUserMessage(consultationRemoval.error) },
      );
    },
    onError: (error) => {
      toast.error("원생 등록에 실패했습니다.", { description: toUserMessage(error) });
    },
  });

  const registrationAction = useMemo(
    () => (
      <ConsultationFormDialog
        open={isRegistrationOpen}
        onOpenChange={setIsRegistrationOpen}
        trigger={
          <Button type="button">
            <MessageSquarePlus aria-hidden="true" />
            상담 등록
          </Button>
        }
        title="상담 등록"
        description="전화·문자 상담 내용을 기록합니다. 접수일은 오늘로 자동 기록됩니다."
        isSubmitting={registerMutation.isPending}
        onSubmit={(profile) => registerMutation.mutate(profile)}
      />
    ),
    [isRegistrationOpen, registerMutation],
  );
  const isHeaderActionMounted = usePageHeaderActions(registrationAction);
  const listView = consultationListQuery.data;

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    resetPage();
  }

  function changeInstrument(nextInstrumentName: string) {
    setInstrumentName(nextInstrumentName);
    resetPage();
  }

  return (
    <section className="grid gap-4" aria-label="상담 목록">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {registrationAction}
      </PageHeaderActionFallback>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_auto]">
          <ListSearchField
            label="상담 검색"
            value={search}
            onChange={changeSearch}
            placeholder="이름, 학교, 전화번호, 악기, 특이사항"
          />
          <ListFilterSelect
            label="악기 필터"
            value={instrumentName}
            options={[...CONSULTATION_INSTRUMENT_NAMES]}
            onChange={changeInstrument}
          />
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setInstrumentName("");
              resetPage();
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {supabaseClientState?.error ? (
          <ListStatusAlert
            message="상담 목록을 불러오지 못했습니다."
            detail={toUserMessage(supabaseClientState.error)}
          />
        ) : null}

        {consultationListQuery.isError ? (
          <ListStatusAlert
            message="상담 목록을 불러오지 못했습니다."
            detail={toUserMessage(consultationListQuery.error)}
          />
        ) : null}

        {consultationListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">상담 목록을 불러오는 중입니다.</p>
        ) : null}

        {listView && !consultationListQuery.isError ? (
          <>
            <ConsultationListTable
              consultations={listView.items}
              onEnrollStudent={setEnrollingConsultation}
              onEdit={setEditingConsultation}
              onDelete={setDeletingConsultation}
            />
            <ListPagination
              itemLabel="상담"
              countUnit="건"
              view={listView}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : null}
      </div>

      {editingConsultation ? (
        <ConsultationFormDialog
          key={editingConsultation.consultationId}
          open
          onOpenChange={(open) => (open ? undefined : setEditingConsultation(null))}
          title="상담 수정"
          description={`${editingConsultation.name} 상담 내용을 수정합니다.`}
          initialValues={toConsultationFormValues(editingConsultation)}
          isSubmitting={updateMutation.isPending}
          onSubmit={(profile) =>
            updateMutation.mutate({
              consultationId: editingConsultation.consultationId,
              ...profile,
            })
          }
        />
      ) : null}

      <ConsultationDeleteDialog
        consultation={deletingConsultation}
        isDeleting={deleteMutation.isPending}
        onClose={() => setDeletingConsultation(null)}
        onConfirm={(consultation) =>
          deleteMutation.mutate({ consultationId: consultation.consultationId })
        }
      />

      {enrollingConsultation ? (
        <StudentRegistrationDialog
          key={enrollingConsultation.consultationId}
          open
          onOpenChange={(open) => (open ? undefined : setEnrollingConsultation(null))}
          teachers={teacherOptions}
          initialValues={{
            name: enrollingConsultation.name,
            age: enrollingConsultation.age,
            school: enrollingConsultation.school,
            phone: enrollingConsultation.phone,
            instrumentNames: enrollingConsultation.instrumentNames,
          }}
          onSubmit={(student) => {
            // 등록 폼에는 처리 중 표시가 없으므로 같은 원생이 두 번 등록되지 않게 여기서 막는다.
            if (!enrollMutation.isPending) {
              enrollMutation.mutate({ consultation: enrollingConsultation, student });
            }
          }}
        />
      ) : null}
    </section>
  );
}

function invalidateConsultations(
  queryClient: ReturnType<typeof useQueryClient>,
  academyId: string,
) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.consultations.all(academyId) });
}

type EnrollmentRequest = {
  consultation: ConsultationListRow;
  student: DemoStudentRegistrationInput;
};

type ConsultationRemoval = { removed: true } | { removed: false; error: unknown };

type ConsultationOperations = {
  register: (input: ConsultationProfile) => Promise<void>;
  update: (input: ConsultationUpdateInput) => Promise<void>;
  remove: (input: { consultationId: string }) => Promise<void>;
  registerStudent: (input: DemoStudentRegistrationInput) => Promise<void>;
};

/**
 * 원생 등록이 실패하면 오류를 그대로 던져 상담 기록을 건드리지 않는다.
 * 등록이 성공한 뒤의 상담 삭제 실패는 원생 등록을 되돌리지 않고 결과로 돌려줘 호출부가 안내하게 한다.
 */
async function registerStudentAndRemoveConsultation(
  operations: ConsultationOperations,
  { consultation, student }: EnrollmentRequest,
): Promise<{ consultationRemoval: ConsultationRemoval }> {
  await operations.registerStudent(student);

  try {
    await operations.remove({ consultationId: consultation.consultationId });
    return { consultationRemoval: { removed: true } };
  } catch (error) {
    return { consultationRemoval: { removed: false, error } };
  }
}

/** 데모·테스트가 넘긴 동작이 있으면 그것을, 없으면 Supabase API를 호출하는 동작 묶음. */
function createConsultationOperations(
  academyId: string,
  supabaseClientState: SupabaseClientState | null,
  overrides: Pick<
    ConsultationListScreenProps,
    "registerConsultation" | "updateConsultation" | "deleteConsultation" | "registerStudent"
  >,
): ConsultationOperations {
  return {
    register: async (input) => {
      if (overrides.registerConsultation) {
        await overrides.registerConsultation(input);
        return;
      }

      await registerConsultationApi(requireSupabaseClient(supabaseClientState), {
        academyId,
        ...input,
      });
    },
    update: async (input) => {
      if (overrides.updateConsultation) {
        await overrides.updateConsultation(input);
        return;
      }

      await updateConsultationApi(requireSupabaseClient(supabaseClientState), {
        academyId,
        ...input,
      });
    },
    remove: async (input) => {
      if (overrides.deleteConsultation) {
        await overrides.deleteConsultation(input);
        return;
      }

      await deleteConsultationApi(requireSupabaseClient(supabaseClientState), {
        academyId,
        ...input,
      });
    },
    registerStudent: async (input) => {
      if (overrides.registerStudent) {
        await overrides.registerStudent(input);
        return;
      }

      await registerStudentEnrollment(requireSupabaseClient(supabaseClientState), {
        academyId,
        name: input.name,
        registeredAt: input.registeredAt,
        age: input.age,
        grade: input.grade,
        school: input.school,
        occupation: input.occupation,
        contact: input.contact,
        instruments: input.instruments,
      });
    },
  };
}

function requireSupabaseClient(supabaseClientState: SupabaseClientState | null) {
  if (!supabaseClientState?.client) {
    throw new Error("Supabase client 상태를 만들지 못했습니다.");
  }

  return supabaseClientState.client;
}

function createSupabaseClientState(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return { client: client as ConsultationSupabaseClient, error: null };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
