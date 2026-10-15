import { describe, expect, it } from "vitest";

import type { PayrollRecord } from "@/domain/payroll";

import {
  fetchFinanceManagementData,
  fetchMonthlyTuitionSnapshots,
  markMonthlyTuitionAsPaid,
  markMonthlyTuitionAsUnpaid,
  markPayrollSettlementAsPaid,
  type FinanceManagementSupabaseClient,
  type FinancePaymentSupabaseClient,
  type FinancePaymentSupabaseResult,
} from "./finance-management";

function createRpcClient(
  dataByFunction: Record<string, unknown>,
  error: Error | null = null,
) {
  const calls: Array<{ functionName: string; payload: Record<string, unknown> }> =
    [];
  const client: FinancePaymentSupabaseClient = {
    async rpc(functionName, payload) {
      calls.push({ functionName, payload });

      return {
        data: error
          ? null
          : (dataByFunction[functionName] as FinancePaymentSupabaseResult),
        error,
      };
    },
  };

  return { calls, client };
}

describe("finance management payment API", () => {
  it("지급 완료된 급여 정산을 수업 원천 데이터와 함께 읽는다", async () => {
    const calls: string[] = [];
    const client = {
      from(table: string) {
        return {
          select() {
            calls.push(table);
            const builder = {
              eq() { return builder; },
              is() { return builder; },
              order() { return builder; },
              then(onFulfilled: (value: unknown) => unknown) {
                return Promise.resolve({
                  data: table === "salary_settlements" ? [{
                    id: "settlement-1", academy_id: "academy-1", teacher_id: "teacher-1",
                    teacher_name: "박선생", month: "2026-08", pay_type: "monthly",
                    base_pay: 840000, withholding_tax: 27720, net_pay: 812280,
                    status: "paid", paid_at: "2026-08-31", lesson_event_ids: [],
                  }] : [],
                  error: null,
                }).then(onFulfilled);
              },
            };
            return builder;
          },
        };
      },
    } as unknown as FinanceManagementSupabaseClient;

    const result = await fetchFinanceManagementData(client, "academy-1");

    expect(calls).toContain("salary_settlements");
    expect(result.salarySettlements).toEqual([expect.objectContaining({
      payrollId: "settlement-1", status: "paid", paidAt: "2026-08-31",
    })]);
  });

  it("교재 출고 조회는 book_releases에 없는 ordered_on 컬럼을 select하지 않는다", async () => {
    const calls: Array<{ table: string; select: string }> = [];
    const createResultBuilder = (table: string, data: unknown) => {
      const builder = {
        eq() {
          return builder;
        },
        is() {
          return builder;
        },
        order() {
          return builder;
        },
        then(onFulfilled: (value: unknown) => unknown) {
          return Promise.resolve({ data, error: null }).then(onFulfilled);
        },
      };

      return {
        select(select: string) {
          calls.push({ table, select });

          return builder;
        },
      };
    };
    const client = {
      from(table: string) {
        if (table === "book_releases") {
          return createResultBuilder(table, []);
        }

        return createResultBuilder(table, []);
      },
    } as unknown as FinanceManagementSupabaseClient;

    await fetchFinanceManagementData(client, "academy-1");

    expect(
      calls.find((call) => call.table === "book_releases")?.select,
    ).toBe(
      "id, academy_id, book_id, student_id, student_name, book_title, price, shipped_at, status, paid_at",
    );
  });

  it("월별 수강료 snapshot RPC 결과를 화면 record로 변환한다", async () => {
    const { calls, client } = createRpcClient({
      ensure_monthly_fixed_income_snapshots: [
        {
          id: "snapshot-1",
          academy_id: "academy-1",
          month: "2026-08",
          student_id: "student-1",
          student_instrument_id: "enrollment-1",
          student_name: "김민지",
          instrument_id: "piano",
          instrument_name: "피아노",
          progress: "체르니 100",
          lesson_fee: 160000,
          discount_total: 10000,
          discount_label: "형제 할인",
          amount: 150000,
          due_on: "2026-08-06",
          status: "unpaid",
          paid_at: null,
          paid_ledger_entry_id: null,
        },
      ],
    });

    await expect(
      fetchMonthlyTuitionSnapshots(client, {
        academyId: "academy-1",
        month: "2026-08",
      }),
    ).resolves.toEqual([
      {
        academyId: "academy-1",
        tuitionId: "snapshot-1",
        month: "2026-08",
        studentId: "student-1",
        studentName: "김민지",
        enrollmentId: "enrollment-1",
        instrumentId: "piano",
        instrumentName: "피아노",
        progress: "체르니 100",
        lessonFee: 160000,
        discountTotal: 10000,
        discountLabel: "형제 할인",
        amount: 150000,
        dueOn: "2026-08-06",
        status: "unpaid",
      },
    ]);
    expect(calls).toEqual([
      {
        functionName: "ensure_monthly_fixed_income_snapshots",
        payload: {
          p_academy_id: "academy-1",
          p_month: "2026-08",
        },
      },
    ]);
  });

  it("수강료 수납과 미수납 처리를 RPC로 위임한다", async () => {
    const paidRow = {
      id: "snapshot-1",
      academy_id: "academy-1",
      month: "2026-08",
      student_id: "student-1",
      student_instrument_id: "enrollment-1",
      student_name: "김민지",
      instrument_id: "piano",
      instrument_name: "피아노",
      progress: "체르니 100",
      lesson_fee: 160000,
      discount_total: 10000,
      discount_label: null,
      amount: 150000,
      due_on: "2026-08-06",
      status: "paid",
      paid_at: "2026-08-25",
      paid_ledger_entry_id: "ledger-1",
    };
    const { calls, client } = createRpcClient({
      mark_fixed_income_snapshot_paid: paidRow,
      mark_fixed_income_snapshot_unpaid: {
        ...paidRow,
        status: "unpaid",
        paid_at: null,
        paid_ledger_entry_id: null,
      },
    });

    await expect(
      markMonthlyTuitionAsPaid(client, {
        academyId: "academy-1",
        tuitionId: "snapshot-1",
        paidAt: "2026-08-25",
      }),
    ).resolves.toMatchObject({
      tuitionId: "snapshot-1",
      status: "paid",
      paidAt: "2026-08-25",
    });
    await expect(
      markMonthlyTuitionAsUnpaid(client, {
        academyId: "academy-1",
        tuitionId: "snapshot-1",
      }),
    ).resolves.toMatchObject({
      tuitionId: "snapshot-1",
      status: "unpaid",
      paidAt: undefined,
    });
    expect(calls).toEqual([
      {
        functionName: "mark_fixed_income_snapshot_paid",
        payload: {
          p_academy_id: "academy-1",
          p_snapshot_id: "snapshot-1",
          p_paid_at: "2026-08-25",
        },
      },
      {
        functionName: "mark_fixed_income_snapshot_unpaid",
        payload: {
          p_academy_id: "academy-1",
          p_snapshot_id: "snapshot-1",
        },
      },
    ]);
  });

  it("급여 지급 확정을 RPC로 위임하고 지급 완료 record를 반환한다", async () => {
    const payroll: PayrollRecord = {
      academyId: "academy-1",
      payrollId: "2026-08:teacher-1",
      teacherId: "teacher-1",
      teacherName: "박선생",
      month: "2026-08",
      payType: "ratio",
      basePay: 84000,
      withholdingTax: 2772,
      netPay: 81228,
      status: "pending",
      lessonEventIds: ["lesson-1", "lesson-2"],
    };
    const { calls, client } = createRpcClient({
      mark_salary_settlement_paid: {
        id: "settlement-1",
        academy_id: "academy-1",
        teacher_id: "teacher-1",
        teacher_name: "박선생",
        month: "2026-08",
        pay_type: "ratio",
        base_pay: 84000,
        withholding_tax: 2772,
        net_pay: 81228,
        status: "paid",
        paid_at: "2026-08-31",
        lesson_event_ids: ["lesson-1", "lesson-2"],
      },
    });

    await expect(
      markPayrollSettlementAsPaid(client, {
        academyId: "academy-1",
        payroll,
        paidAt: "2026-08-31",
      }),
    ).resolves.toMatchObject({
      payrollId: "settlement-1",
      status: "paid",
      paidAt: "2026-08-31",
      netPay: 81228,
    });
    expect(calls[0]).toEqual({
      functionName: "mark_salary_settlement_paid",
      payload: {
        p_academy_id: "academy-1",
        p_teacher_id: "teacher-1",
        p_teacher_name: "박선생",
        p_month: "2026-08",
        p_pay_type: "ratio",
        p_base_pay: 84000,
        p_withholding_tax: 2772,
        p_net_pay: 81228,
        p_lesson_event_ids: ["lesson-1", "lesson-2"],
        p_paid_at: "2026-08-31",
      },
    });
  });
});
