import { describe, expect, it } from "vitest";

import type { PayrollRecord } from "@/domain/payroll";

import {
  cancelPayrollSettlementPaid,
  clearMonthlyTuitionOverdue,
  fetchFinanceManagementData,
  fetchMonthTuitionSnapshotRows,
  fetchYearlyTuitionSnapshots,
  markMonthlyTuitionAsOverdue,
  fetchLessonTicketIncomeRegistrations,
  fetchMonthlyTuitionSnapshots,
  markMonthlyTuitionAsPaid,
  markMonthlyTuitionAsUnpaid,
  markPayrollSettlementAsPaid,
  createYearlyTuitionSnapshotsQueryOptions,
  type FinanceManagementSupabaseClient,
  type FinancePaymentSupabaseClient,
  type FinancePaymentSupabaseResult,
} from "./finance-management";
import { createFakeSupabase, createNumberedRows } from "./test-support/fake-supabase";

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

const MONTH = "2026-08";

function createFinanceClient(
  rowsByTable: Parameters<typeof createFakeSupabase>[0] = {},
  options: Parameters<typeof createFakeSupabase>[1] = {},
) {
  const fake = createFakeSupabase(rowsByTable, options);

  return {
    ...fake,
    client: fake.client as unknown as FinanceManagementSupabaseClient,
  };
}

function loadFinanceData(
  rowsByTable: Parameters<typeof createFakeSupabase>[0] = {},
  month = MONTH,
) {
  const finance = createFinanceClient(rowsByTable);

  return fetchFinanceManagementData(finance.client, "academy-1", { month }).then((result) => ({
    result,
    ...finance,
  }));
}

const lessonRow = (id: string, origin: string, lessonKind: string) => ({
  id,
  academy_id: "academy-1",
  student_id: "student-1",
  teacher_id: "teacher-1",
  lesson_kind: lessonKind,
  origin,
  instrument_id: "violin",
  instrument_name: "바이올린",
  starts_at: "2026-08-31T15:00:00Z",
  ends_at: "2026-08-31T16:00:00Z",
  students: { name: "김민지" },
  student_instruments: { final_monthly_fee: 140000 },
  attendance_records: [{ status: "present" }],
});

const teacherRow = (id: string, name: string, status: string) => ({
  id,
  academy_id: "academy-1",
  name,
  part: "피아노",
  phone: null,
  registered_on: "2026-01-01",
  salary_type: "monthly",
  status,
  archived_at: null,
  teacher_work_schedules: [],
  teacher_salary_settings: [],
});

const snapshotRow = (overrides: Record<string, unknown> = {}) => ({
  id: "snapshot-1",
  academy_id: "academy-1",
  month: MONTH,
  student_id: "student-1",
  student_instrument_id: "enrollment-1",
  student_name: "김민지",
  instrument_id: "piano",
  instrument_name: "피아노",
  amount: 150000,
  status: "paid",
  paid_at: "2026-08-05",
  paid_ledger_entry_id: "ledger-1",
  ...overrides,
});

describe("finance management payment API", () => {
  it("회차권 등록 이력 조회 실패를 빈 수입으로 숨기지 않는다", async () => {
    const { client } = createFinanceClient(
      {},
      { errors: { lesson_ticket_registrations: new Error("permission denied") } },
    );

    await expect(fetchLessonTicketIncomeRegistrations(client, "academy-1"))
      .rejects.toThrow("회차권 등록 내역을 불러오지 못했습니다: permission denied");
  });

  it("회차권 등록 이력을 학원 단위로 읽고 각 등록 원장 ID를 보존한다", async () => {
    const { result, queriesFor } = await loadFinanceData({
      lesson_ticket_registrations: [{
        id: "registration-1", academy_id: "academy-1",
        lesson_ticket_grant_id: "ticket-1", registered_at: "2026-08-05",
        granted_count: 4, valid_until: "2026-09-04",
        original_paid_amount: 140000, ledger_entry_id: "ledger-1",
      }],
    });

    expect(queriesFor("lesson_ticket_registrations")[0]).toMatchObject({
      eq: [["academy_id", "academy-1"]],
      order: [["id", undefined]],
      range: [[0, 999]],
    });
    expect(result.ticketRegistrations).toEqual([{
      registrationId: "registration-1", academyId: "academy-1",
      ticketId: "ticket-1", registeredAt: "2026-08-05", grantedCount: 4,
      validUntil: "2026-09-04", originalPaidAmount: 140000,
      ledgerEntryId: "ledger-1",
    }]);
  });

  it("수입 원장은 선택한 달 범위만 서버에서 거르고 최신순·id순으로 읽는다", async () => {
    const { queriesFor } = await loadFinanceData({}, "2026-02");

    expect(queriesFor("ledger_entries")[0]).toMatchObject({
      eq: [["academy_id", "academy-1"]],
      gte: [["occurred_on", "2026-02-01"]],
      lte: [["occurred_on", "2026-02-28"]],
      order: [["occurred_on", { ascending: false }], ["id", undefined]],
    });
  });

  it("그 달 급여 정산만 서버에서 거르고 수업 원천 데이터와 함께 읽는다", async () => {
    const { result, queriesFor } = await loadFinanceData({
      salary_settlements: [{
        id: "settlement-1", academy_id: "academy-1", teacher_id: "teacher-1",
        teacher_name: "박선생", month: MONTH, pay_type: "monthly",
        base_pay: 840000, withholding_tax: 27720, net_pay: 812280,
        status: "paid", paid_at: "2026-08-31", lesson_event_ids: [],
        paid_ledger_entry_id: null,
      }],
    });

    expect(queriesFor("salary_settlements")[0]).toMatchObject({
      eq: [["academy_id", "academy-1"], ["month", MONTH]],
      order: [["id", undefined]],
    });
    expect(result.salarySettlements).toEqual([expect.objectContaining({
      payrollId: "settlement-1", status: "paid", paidAt: "2026-08-31",
      ledgerEntryId: null,
    })]);
  });

  it("급여 계산용 수업은 취소·삭제 일정을 빼고 보강 일정을 보강으로 구분해 origin과 함께 읽는다", async () => {
    const { result, queriesFor } = await loadFinanceData({
      lesson_events: [
        lessonRow("regular", "regular", "academy"),
        lessonRow("makeup", "makeup", "academy"),
        lessonRow("private", "private", "private"),
      ],
    });

    const query = queriesFor("lesson_events")[0];
    expect(query.eq).toContainEqual(["status", "scheduled"]);
    expect(query.select).toContain("origin");
    expect(
      result.payrollLessonSources.map((source) => [source.lessonEventId, source.lessonKind, source.origin]),
    ).toEqual([
      ["regular", "academy", "regular"],
      ["makeup", "makeup", "makeup"],
      ["private", "private", "private"],
    ]);
  });

  it("급여 계산용 수업은 한국 시간 기준 그 달 [1일 0시, 다음 달 1일 0시) 범위만 서버에서 거른다", async () => {
    const { queriesFor } = await loadFinanceData({}, "2026-08");
    const december = await loadFinanceData({}, "2026-12");

    expect(queriesFor("lesson_events")[0]).toMatchObject({
      eq: [["academy_id", "academy-1"], ["status", "scheduled"]],
      gte: [["starts_at", "2026-08-01T00:00:00+09:00"]],
      lt: [["starts_at", "2026-09-01T00:00:00+09:00"]],
      order: [["starts_at", undefined], ["id", undefined]],
    });
    expect(december.queriesFor("lesson_events")[0]).toMatchObject({
      gte: [["starts_at", "2026-12-01T00:00:00+09:00"]],
      lt: [["starts_at", "2027-01-01T00:00:00+09:00"]],
    });
  });

  it("회차권 원장 행은 월과 무관하게 함께 읽어 다른 달로 옮긴 원장을 누락으로 오해하지 않는다", async () => {
    const ledgerRow = (id: string, occurredOn: string, source: string) => ({
      id, academy_id: "academy-1", occurred_on: occurredOn, entry_type: "income", source,
      category: "other", amount: 100000, description: id, ref_id: null,
    });
    const { result, queriesFor } = await loadFinanceData({
      ledger_entries: [
        ledgerRow("ledger-month", "2026-08-10", "manual"),
        ledgerRow("ledger-ticket-july", "2026-07-10", "lesson-ticket"),
        // 월 조회와 회차권 조회 양쪽에 걸리는 행은 한 번만 담는다.
        ledgerRow("ledger-ticket-august", "2026-08-12", "lesson-ticket"),
      ],
    });

    const queries = queriesFor("ledger_entries");
    expect(queries.some((query) => query.gte?.[0]?.[1] === "2026-08-01")).toBe(true);
    expect(
      queries.some(
        (query) =>
          query.eq?.some(([column, value]) => column === "source" && value === "lesson-ticket") &&
          !query.gte?.length,
      ),
    ).toBe(true);
    expect(result.ledgerEntries.map((entry) => entry.ledgerId).sort()).toEqual([
      "ledger-month",
      "ledger-ticket-august",
      "ledger-ticket-july",
    ]);
  });

  it("1000건을 넘는 수업과 원장도 range를 이어 끝까지 읽어 조용히 잘리지 않는다", async () => {
    const { result, queriesFor } = await loadFinanceData({
      lesson_events: createNumberedRows(1200, (index) => lessonRow(`lesson-${index}`, "regular", "academy")),
      ledger_entries: createNumberedRows(1200, (index) => ({
        id: `ledger-${index}`, academy_id: "academy-1", occurred_on: "2026-08-10",
        entry_type: "income", source: "manual", category: "other", amount: 1000,
        description: `수입${index}`, ref_id: null,
      })),
    });

    expect(result.payrollLessonSources).toHaveLength(1200);
    expect(result.ledgerEntries).toHaveLength(1200);
    expect(queriesFor("lesson_events").map((query) => query.range[0])).toEqual([[0, 999], [1000, 1999]]);
    // 월 범위 원장 조회(gte 있음)가 두 페이지로 끝까지 읽힌다. 회차권 원장 조회는 별도 쿼리다.
    expect(queriesFor("ledger_entries").filter((query) => query.gte?.length).map((query) => query.range[0])).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("수입 계산용 회차권과 선생님은 목록 페이지로 자르지 않고 12건 전체를 가져온다", async () => {
    const ticketRows = Array.from({ length: 12 }, (_, index) => ({
      id: `ticket-${index}`, academy_id: "academy-1", student_id: `student-${index}`,
      instrument_id: "piano", instrument_name: "피아노", total_granted_count: 4,
      remaining_count: 4, valid_from: "2026-08-01", valid_until: "2026-12-31",
      registered_at: "2026-08-05", paid_amount: 100000, paid_at: "2026-08-05",
      students: { name: `원생${index}` },
    }));
    const teacherRows = Array.from({ length: 12 }, (_, index) =>
      teacherRow(`teacher-${index}`, `선생님${index}`, "employed"),
    );

    const { result, queriesFor } = await loadFinanceData({
      lesson_ticket_grants: ticketRows,
      teachers: teacherRows,
    });

    expect(Array.isArray(result.tickets)).toBe(true);
    expect(result.tickets).toHaveLength(12);
    expect(result.teachers).toHaveLength(12);
    expect(queriesFor("lesson_ticket_grants")[0].order).toEqual([["id", undefined]]);
    expect(queriesFor("students")[0].order).toEqual([["id", undefined]]);
  });

  it("급여용 선생님은 재직·휴직·퇴사를 모두 가나다순으로 읽는다", async () => {
    const { result, queriesFor } = await loadFinanceData({
      teachers: [
        teacherRow("teacher-1", "다선생", "resigned"),
        teacherRow("teacher-2", "가선생", "employed"),
        teacherRow("teacher-3", "나선생", "on_leave"),
      ],
    });

    expect(result.teachers.map((teacher) => [teacher.name, teacher.status])).toEqual([
      ["가선생", "employed"],
      ["나선생", "on_leave"],
      ["다선생", "resigned"],
    ]);
    // 보관된 선생님도 그 달 지급 기록이 있을 수 있어 archived_at으로 거르지 않는다.
    expect(queriesFor("teachers")[0]).toMatchObject({ eq: [["academy_id", "academy-1"]] });
    expect(queriesFor("teachers")[0].is ?? []).toEqual([]);
  });

  it("교재 판매는 그 달 결제 완료분만 서버에서 거르고 결제 원장 연결을 보존한다", async () => {
    const { result, queriesFor } = await loadFinanceData({
      book_releases: [{
        id: "release-1", academy_id: "academy-1", book_id: "book-1",
        student_id: "student-1", student_name: "김민지", book_title: "바이엘 2",
        price: 12000, quantity: 1, shipped_at: "2026-08-01", status: "paid", paid_at: "2026-08-25",
        paid_ledger_entry_id: "ledger-9",
      }],
    });

    const query = queriesFor("book_releases")[0];
    expect(query.select).toBe(
      "id, academy_id, book_id, student_id, student_name, book_title, price, quantity, shipped_at, status, paid_at, paid_ledger_entry_id",
    );
    expect(query).toMatchObject({
      eq: [["academy_id", "academy-1"], ["status", "paid"]],
      gte: [["paid_at", "2026-08-01"]],
      lte: [["paid_at", "2026-08-31"]],
      order: [["paid_at", undefined], ["id", undefined]],
    });
    expect(result.bookSales).toEqual([
      expect.objectContaining({ saleId: "release-1", status: "paid", paidLedgerEntryId: "ledger-9" }),
    ]);
  });

  it("그 달 수강료 snapshot은 RPC 없이 읽기만 하고 급여 계산용으로 돌려준다", async () => {
    const { result, queriesFor, rpcCalls } = await loadFinanceData({
      fixed_income_snapshots: [snapshotRow()],
    });

    expect(rpcCalls).toEqual([]);
    expect(queriesFor("fixed_income_snapshots")[0]).toMatchObject({
      eq: [["academy_id", "academy-1"], ["month", MONTH]],
      order: [["id", undefined]],
    });
    expect(result.monthTuitionSnapshots).toEqual([
      expect.objectContaining({ tuitionId: "snapshot-1", month: MONTH, amount: 150000, instrumentName: "피아노" }),
    ]);
  });

  it("fetchMonthTuitionSnapshotRows는 snapshot 조회 오류를 숨기지 않는다", async () => {
    const { client } = createFinanceClient(
      {},
      { errors: { fixed_income_snapshots: new Error("permission denied") } },
    );

    await expect(
      fetchMonthTuitionSnapshotRows(client, { academyId: "academy-1", month: MONTH }),
    ).rejects.toThrow("월별 수강료를 불러오지 못했습니다: permission denied");
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
        paidLedgerEntryId: null,
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

  it("수강료 입금과 입금 취소를 RPC로 위임한다", async () => {
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

  it("수강료 미납 처리를 RPC로 위임하고 미납 record를 반환한다", async () => {
    const { calls, client } = createRpcClient({
      mark_fixed_income_snapshot_overdue: {
        id: "snapshot-1",
        academy_id: "academy-1",
        month: "2026-08",
        student_id: "student-1",
        student_instrument_id: "enrollment-1",
        student_name: "김민지",
        instrument_id: "piano",
        instrument_name: "피아노",
        amount: 150000,
        status: "overdue",
        paid_at: null,
        paid_ledger_entry_id: null,
      },
    });

    await expect(
      markMonthlyTuitionAsOverdue(client, { academyId: "academy-1", tuitionId: "snapshot-1" }),
    ).resolves.toMatchObject({ tuitionId: "snapshot-1", status: "overdue" });
    expect(calls).toEqual([
      {
        functionName: "mark_fixed_income_snapshot_overdue",
        payload: { p_academy_id: "academy-1", p_snapshot_id: "snapshot-1" },
      },
    ]);
  });

  it("수강료 미납 해제를 RPC로 위임하고 미입금 record를 반환한다", async () => {
    const { calls, client } = createRpcClient({
      clear_fixed_income_snapshot_overdue: snapshotRow({ status: "unpaid", paid_at: null, paid_ledger_entry_id: null }),
    });

    await expect(
      clearMonthlyTuitionOverdue(client, { academyId: "academy-1", tuitionId: "snapshot-1" }),
    ).resolves.toMatchObject({ tuitionId: "snapshot-1", status: "unpaid" });
    expect(calls).toEqual([
      {
        functionName: "clear_fixed_income_snapshot_overdue",
        payload: { p_academy_id: "academy-1", p_snapshot_id: "snapshot-1" },
      },
    ]);
  });

  it("미납 해제 RPC 오류는 안내 문구로 감싸 전달한다", async () => {
    const { client } = createRpcClient({}, new Error("권한이 없습니다."));

    await expect(
      clearMonthlyTuitionOverdue(client, { academyId: "academy-1", tuitionId: "snapshot-1" }),
    ).rejects.toThrow("수강료 미납 해제에 실패했습니다: 권한이 없습니다.");
  });

  it("급여 지급 취소를 RPC로 위임하고 미지급 record를 반환한다", async () => {
    const { calls, client } = createRpcClient({
      cancel_salary_settlement_paid: {
        id: "settlement-1",
        academy_id: "academy-1",
        teacher_id: "teacher-1",
        teacher_name: "박선생",
        month: "2026-08",
        pay_type: "monthly",
        base_pay: 840000,
        withholding_tax: 27720,
        net_pay: 812280,
        status: "pending",
        paid_at: null,
        lesson_event_ids: [],
        paid_ledger_entry_id: null,
      },
    });

    await expect(
      cancelPayrollSettlementPaid(client, {
        academyId: "academy-1",
        teacherId: "teacher-1",
        month: "2026-08",
      }),
    ).resolves.toMatchObject({ status: "pending", paidAt: undefined });
    expect(calls).toEqual([
      {
        functionName: "cancel_salary_settlement_paid",
        payload: { p_academy_id: "academy-1", p_teacher_id: "teacher-1", p_month: "2026-08" },
      },
    ]);
  });

  it("연간 월수강료는 해당 연도 1~12월 범위만 서버에서 걸러 월·id순으로 끝까지 읽는다", async () => {
    const { client, queries } = createFinanceClient({ fixed_income_snapshots: [snapshotRow({ month: "2026-03" })] });

    const records = await fetchYearlyTuitionSnapshots(client, { academyId: "academy-1", year: 2026 });

    expect(queries).toEqual([
      expect.objectContaining({
        table: "fixed_income_snapshots",
        eq: [["academy_id", "academy-1"]],
        gte: [["month", "2026-01"]],
        lte: [["month", "2026-12"]],
        order: [["month", undefined], ["id", undefined]],
        range: [[0, 999]],
      }),
    ]);
    expect(records).toEqual([
      expect.objectContaining({
        tuitionId: "snapshot-1",
        month: "2026-03",
        instrumentId: "piano",
        instrumentName: "피아노",
        amount: 150000,
        status: "paid",
      }),
    ]);
  });

  it("악기 그래프용 연간 조회는 입금 완료만 서버에서 걸고 queryKey에도 status를 담는다", async () => {
    const { client, queries } = createFinanceClient({ fixed_income_snapshots: [snapshotRow()] });

    await fetchYearlyTuitionSnapshots(client, { academyId: "academy-1", year: 2026, status: "paid" });
    const paidOptions = createYearlyTuitionSnapshotsQueryOptions(client, { academyId: "academy-1", year: 2026, status: "paid" });
    const allOptions = createYearlyTuitionSnapshotsQueryOptions(client, { academyId: "academy-1", year: 2026 });

    expect(queries[0].eq).toEqual([["academy_id", "academy-1"], ["status", "paid"]]);
    expect(paidOptions.queryKey).not.toEqual(allOptions.queryKey);
    expect(paidOptions.queryKey).toContain("paid");
  });

  it("연간 월수강료가 1000건을 넘어도 끝까지 읽는다", async () => {
    const { client, queries } = createFinanceClient({
      fixed_income_snapshots: createNumberedRows(1200, (index) => snapshotRow({ id: `snapshot-${index}` })),
    });

    await expect(
      fetchYearlyTuitionSnapshots(client, { academyId: "academy-1", year: 2026 }),
    ).resolves.toHaveLength(1200);
    expect(queries.map((query) => query.range[0])).toEqual([[0, 999], [1000, 1999]]);
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
