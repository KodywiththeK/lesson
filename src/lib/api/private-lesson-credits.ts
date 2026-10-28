export type PrivateLessonCreditBalance = {
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  openCount: number;
};

export type PrivateLessonCreditBalanceClient = {
  rpc(
    functionName: "get_private_lesson_credit_balances",
    payload: { p_academy_id: string },
  ): PromiseLike<{ data: Array<{
    student_id: string;
    student_name: string;
    instrument_id: string;
    instrument_name: string;
    open_count: number;
  }> | null; error: Error | null }>;
};

export async function fetchPrivateLessonCreditBalances(
  client: PrivateLessonCreditBalanceClient,
  academyId: string,
): Promise<PrivateLessonCreditBalance[]> {
  const { data, error } = await client.rpc("get_private_lesson_credit_balances", {
    p_academy_id: academyId,
  });
  if (error) throw new Error(`미정산 레슨을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map((row) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    openCount: row.open_count,
  }));
}
