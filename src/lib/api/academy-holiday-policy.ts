export type AcademyHolidayPolicy = { excludePublicHolidays: boolean; excludeAcademyClosures: boolean };

type PolicyRow = { exclude_public_holidays: boolean; exclude_academy_closures: boolean };
export type AcademyHolidayPolicyClient = {
  from(table: "academy_holiday_policies"): {
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: PolicyRow | null; error: Error | null }> } };
  };
  rpc(name: "save_academy_holiday_policy", input: Record<string, unknown>): PromiseLike<{ error: Error | null }>;
};

export async function fetchAcademyHolidayPolicy(client: Pick<AcademyHolidayPolicyClient, "from">, academyId: string): Promise<AcademyHolidayPolicy> {
  const { data, error } = await client.from("academy_holiday_policies")
    .select("exclude_public_holidays,exclude_academy_closures").eq("academy_id", academyId).maybeSingle();
  if (error) throw new Error(`쉬는 날 설정을 불러오지 못했습니다: ${error.message}`);
  return { excludePublicHolidays: data?.exclude_public_holidays ?? true, excludeAcademyClosures: data?.exclude_academy_closures ?? true };
}

export async function saveAcademyHolidayPolicy(client: Pick<AcademyHolidayPolicyClient, "rpc">, academyId: string, policy: AcademyHolidayPolicy) {
  const { error } = await client.rpc("save_academy_holiday_policy", {
    p_academy_id: academyId, p_exclude_public_holidays: policy.excludePublicHolidays,
    p_exclude_academy_closures: policy.excludeAcademyClosures,
  });
  if (error) throw new Error(`쉬는 날 설정을 저장하지 못했습니다: ${error.message}`);
}
