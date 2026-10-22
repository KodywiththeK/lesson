"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  LESSON_TICKET_REFUND_POLICY_OPTIONS,
  type LessonTicketRefundPolicy,
} from "@/domain/lesson-ticket-refund";
import {
  createLessonTicketRefundPolicyQueryOptions,
  setLessonTicketRefundPolicy,
  type AcademySettingsSupabaseClient,
} from "@/lib/api/academy-settings";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PolicyQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<LessonTicketRefundPolicy>;
};

type LessonTicketSettingsScreenProps = {
  academyId: string;
  /** 데모·테스트가 서버 대신 쓰는 읽기. 없으면 Supabase에서 읽는다. */
  queryOptions?: PolicyQueryOptions;
  savePolicy?: (policy: LessonTicketRefundPolicy) => Promise<unknown>;
};

/** 회차권 환불 규정을 고르는 설정 화면. 원장만 열 수 있고, 저장한 규정은 회차권 삭제(환불 처리)에 적용된다. */
export function LessonTicketSettingsScreen({
  academyId,
  queryOptions,
  savePolicy,
}: LessonTicketSettingsScreenProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LessonTicketRefundPolicy | null>(null);
  const supabase = useMemo(
    () => (queryOptions && savePolicy ? null : createSettingsClient()),
    [queryOptions, savePolicy],
  );
  const clientUnavailable = supabase?.error ?? new Error("Supabase client 상태를 만들지 못했습니다.");
  const resolvedQueryOptions =
    queryOptions ??
    (supabase?.client
      ? createLessonTicketRefundPolicyQueryOptions(supabase.client, academyId)
      : failingQueryOptions(clientUnavailable));
  const policyQuery = useQuery({
    queryKey: resolvedQueryOptions.queryKey,
    queryFn: resolvedQueryOptions.queryFn,
  });
  const saveMutation = useMutation({
    mutationFn: (policy: LessonTicketRefundPolicy) => {
      if (savePolicy) return savePolicy(policy);
      if (!supabase?.client) throw clientUnavailable;

      return setLessonTicketRefundPolicy(supabase.client, { academyId, policy });
    },
    onSuccess: (_result, policy) => {
      toast.success("회차권 환불 규정을 저장했습니다.");
      setDraft(null);
      // 저장한 값을 바로 반영해 다시 읽는 왕복을 줄인다.
      queryClient.setQueryData(resolvedQueryOptions.queryKey, policy);
    },
    onError: (error) => {
      toast.error("회차권 환불 규정 저장에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const savedPolicy = policyQuery.data;
  const selectedPolicy = draft ?? savedPolicy;
  const isDirty = draft !== null && draft !== savedPolicy;

  return (
    <section aria-label="회차권 설정" className="grid gap-4">
      <SectionCard className="grid gap-4">
        <SectionHeader
          title="회차권 환불 규정"
          description="회차권을 삭제할 때 적용됩니다. 학원마다 다르게 정할 수 있고, 처음에는 환불 불가입니다."
        />

        {policyQuery.isLoading ? <EmptyState>환불 규정을 불러오는 중입니다.</EmptyState> : null}

        {policyQuery.isError ? (
          <ListStatusAlert
            message="회차권 환불 규정을 불러오지 못했습니다."
            detail={toUserMessage(policyQuery.error)}
          />
        ) : null}

        {selectedPolicy ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();

              if (draft && isDirty) {
                saveMutation.mutate(draft);
              }
            }}
          >
            <RadioGroup
              aria-label="회차권 환불 규정"
              value={selectedPolicy}
              onValueChange={(value) => setDraft(value as LessonTicketRefundPolicy)}
            >
              {LESSON_TICKET_REFUND_POLICY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                >
                  <RadioGroupItem value={option.value} className="mt-1" />
                  <span className="grid gap-1">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-sm text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>

            <div className="flex justify-end">
              <Button type="submit" disabled={!isDirty || saveMutation.isPending}>
                {saveMutation.isPending ? "저장 중" : "저장"}
              </Button>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </section>
  );
}

function failingQueryOptions(error: Error): PolicyQueryOptions {
  return {
    queryKey: ["settings", "lesson-ticket-refund-policy", "unavailable"],
    queryFn: async () => {
      throw error;
    },
  };
}

function createSettingsClient():
  | { client: AcademySettingsSupabaseClient; error: null }
  | { client: null; error: Error } {
  try {
    return { client: createSupabaseBrowserClient() as unknown as AcademySettingsSupabaseClient, error: null };
  } catch (error) {
    return { client: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
