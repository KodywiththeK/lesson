import {
  DEFAULT_LESSON_TICKET_REFUND_POLICY,
  LESSON_TICKET_REFUND_POLICIES,
  type LessonTicketRefundPolicy,
} from "@/domain/lesson-ticket-refund";

import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type AcademySettingsRow = {
  lesson_ticket_refund_policy: string;
};

export type AcademySettingsSupabaseClient = {
  from(table: "academy_settings"): {
    select(select: string): {
      eq(
        column: "academy_id",
        value: string,
      ): { maybeSingle(): PromiseLike<SupabaseQueryResult<AcademySettingsRow>> };
    };
  };
  rpc(
    functionName: "set_lesson_ticket_refund_policy",
    payload: { p_academy_id: string; p_policy: LessonTicketRefundPolicy },
  ): PromiseLike<SupabaseQueryResult<AcademySettingsRow>>;
};

function toRefundPolicy(value: string): LessonTicketRefundPolicy {
  const policy = LESSON_TICKET_REFUND_POLICIES.find((candidate) => candidate === value);

  if (!policy) {
    throw new Error(`회차권 환불 규정을 알 수 없습니다: ${value}`);
  }

  return policy;
}

/** 학원 설정 행이 아직 없으면 기본 규정(환불 불가)이다. 원장만 읽을 수 있다. */
export async function fetchLessonTicketRefundPolicy(
  supabase: AcademySettingsSupabaseClient,
  academyId: string,
): Promise<LessonTicketRefundPolicy> {
  const { data, error } = await supabase
    .from("academy_settings")
    .select("lesson_ticket_refund_policy")
    .eq("academy_id", academyId)
    .maybeSingle();

  if (error) {
    throw new Error(`회차권 환불 규정을 불러오지 못했습니다: ${error.message}`);
  }

  return data ? toRefundPolicy(data.lesson_ticket_refund_policy) : DEFAULT_LESSON_TICKET_REFUND_POLICY;
}

export async function setLessonTicketRefundPolicy(
  supabase: AcademySettingsSupabaseClient,
  input: { academyId: string; policy: LessonTicketRefundPolicy },
): Promise<LessonTicketRefundPolicy> {
  const { data, error } = await supabase.rpc("set_lesson_ticket_refund_policy", {
    p_academy_id: input.academyId,
    p_policy: input.policy,
  });

  if (error) {
    throw new Error(`회차권 환불 규정을 저장하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("회차권 환불 규정을 저장했지만 반환된 데이터가 없습니다.");
  }

  return toRefundPolicy(data.lesson_ticket_refund_policy);
}

export function createLessonTicketRefundPolicyQueryOptions(
  supabase: AcademySettingsSupabaseClient,
  academyId: string,
) {
  return {
    queryKey: queryKeys.settings.lessonTicketRefundPolicy(academyId),
    queryFn: () => fetchLessonTicketRefundPolicy(supabase, academyId),
  };
}
