"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  CircleDollarSign,
  Download,
  Pencil,
  RotateCcw,
  Trash2,
  UsersRound,
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
import { DateField, MonthField } from "@/components/operations/date-time-fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BookSale, LedgerCategory, LedgerEntry } from "@/domain/book-sale";
import {
  buildListView,
  compareKoreanNames,
  type ListView,
  type PageSizeOption,
} from "@/domain/common-list";
import { getFinanceToday } from "@/domain/finance-date";
import {
  buildFinanceCalendarDays,
  buildFinanceLedgerPage,
  buildIncomeExpenseGraph,
  exportFinanceLedgerCsv,
  formatLedgerCategory,
  formatLedgerEntrySource,
  formatLedgerEntryType,
  ledgerCategoryOptions,
  toDefaultLedgerCategory,
  type BuildFinanceLedgerListOptions,
  type FinanceLedgerSort,
} from "@/domain/finance-ledger";
import type { LessonTicketListItem } from "@/domain/lesson-ticket";
import {
  buildCompletedLessonRevenues,
  calculateHourlyPayroll,
  calculateMonthlyPayroll,
  calculateRatioPayroll,
  type PayrollLessonSource,
  type PayrollRecord,
} from "@/domain/payroll";
import type { StudentEnrollment } from "@/domain/student-registration";
import type { TeacherListRow } from "@/domain/teacher-list";
import {
  createMonthlyTuitionSnapshot,
  type TuitionRecord,
} from "@/domain/tuition-income";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  createFinanceLedgerListQueryOptions,
  deleteFinanceLedgerEntry as deleteFinanceLedgerEntryApi,
  registerManualLedgerEntry as registerManualLedgerEntryApi,
  updateFinanceLedgerEntry as updateFinanceLedgerEntryApi,
  type FinanceLedgerListSupabaseClient,
  type FinanceLedgerMutationSupabaseClient,
  type RegisterManualLedgerEntryInput,
} from "@/lib/api/finance";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type FinanceLedgerListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<LedgerEntry[]>;
};

export type FinanceLedgerListQueryOptionsFactory = (
  options: BuildFinanceLedgerListOptions,
) => FinanceLedgerListQueryOptions;

export type FinanceManagementData = {
  ledgerEntries: LedgerEntry[];
  enrollments: StudentEnrollment[];
  tickets: LessonTicketListItem[];
  bookSales: BookSale[];
  teachers: TeacherListRow[];
  academySheets?: FinanceManagementAttendanceSheets;
  payrollLessonSources?: PayrollLessonSource[];
  salarySettlements?: PayrollRecord[];
};

type FinanceManagementAttendanceSheets = Record<
  string,
  {
    rows: Array<{
      academyId: string;
      lessonEventId: string;
      studentId: string;
      studentName: string;
      teacherId?: string;
      instrumentId: string;
      instrumentName: string;
      date: string;
      startTime: string;
      endTime: string;
      status: PayrollLessonSource["status"];
      origin?: string;
    }>;
  }
>;

type FinanceLedgerListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: FinanceLedgerListQueryOptionsFactory;
  registerManualLedgerEntry?: (input: RegisterManualLedgerEntryInput) => void | Promise<void>;
  updateLedgerEntry?: (input: LedgerEntry) => void | Promise<void>;
  deleteLedgerEntry?: (input: { ledgerId: string }) => void | Promise<void>;
};

type FinanceDataScreenProps = {
  academyId: string;
  financeData: FinanceManagementData;
  markPayrollPaid?: (input: {
    academyId: string;
    payroll: PayrollRecord;
    paidAt: string;
  }) => Promise<PayrollRecord>;
  markTuitionPaid?: (input: {
    academyId: string;
    tuitionId: string;
    paidAt: string;
  }) => Promise<TuitionRecord>;
  markTuitionUnpaid?: (input: {
    academyId: string;
    tuitionId: string;
  }) => Promise<TuitionRecord>;
  tuitionSnapshotsQueryOptionsFactory?: (
    month: string,
  ) => {
    queryKey: QueryKey;
    queryFn: () => Promise<TuitionRecord[]>;
  };
};

type FinanceLedgerSupabaseClient = FinanceLedgerListSupabaseClient &
  FinanceLedgerMutationSupabaseClient;

type SupabaseClientState =
  | {
      client: FinanceLedgerSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

type LedgerDraft = {
  ledgerId?: string;
  occurredOn: string;
  type: LedgerEntry["type"];
  source: LedgerEntry["source"];
  category: LedgerCategory;
  amount: number;
  description: string;
};

type LessonIncomeRow = {
  id: string;
  studentId: string;
  source: "tuition" | "lesson-ticket";
  studentName: string;
  lessonKindLabel: "학원레슨 월수강료" | "개인레슨 회차권";
  instrumentName: string;
  progress: string;
  lessonFee: number;
  discountTotal: number;
  finalAmount: number;
  status: "paid" | "unpaid";
  paidAt?: string;
};

type BookFinanceRow = {
  id: string;
  studentName: string;
  bookTitle: string;
  amount: number;
  orderedOn: string;
  shippedAt: string;
  paidAt: string;
  status: BookSale["status"];
};

const typeFilterOptions: Array<{
  value: LedgerEntry["type"];
  label: string;
}> = [
  { value: "income", label: formatLedgerEntryType("income") },
  { value: "expense", label: formatLedgerEntryType("expense") },
];

const sourceFilterOptions: Array<{
  value: LedgerEntry["source"];
  label: string;
}> = [
  { value: "tuition", label: formatLedgerEntrySource("tuition") },
  { value: "book-sale", label: formatLedgerEntrySource("book-sale") },
  { value: "lesson-ticket", label: formatLedgerEntrySource("lesson-ticket") },
  { value: "payroll", label: formatLedgerEntrySource("payroll") },
  { value: "manual", label: formatLedgerEntrySource("manual") },
];

const sortOptions: Array<{
  value: string;
  label: string;
  sort: FinanceLedgerSort;
}> = [
  {
    value: "occurredOn-desc",
    label: "날짜 최신순",
    sort: { field: "occurredOn", direction: "desc" },
  },
  {
    value: "occurredOn-asc",
    label: "날짜 오래된순",
    sort: { field: "occurredOn", direction: "asc" },
  },
  {
    value: "amount-desc",
    label: "금액 높은순",
    sort: { field: "amount", direction: "desc" },
  },
  {
    value: "amount-asc",
    label: "금액 낮은순",
    sort: { field: "amount", direction: "asc" },
  },
];

const withholdingTaxRate = 0.033;

export function FinanceLedgerListScreen({
  academyId,
  queryOptionsFactory,
  registerManualLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
}: FinanceLedgerListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<LedgerEntry["type"] | "">("");
  const [source, setSource] = useState<LedgerEntry["source"] | "">("");
  const [category, setCategory] = useState<LedgerCategory | "">("");
  const [sortValue, setSortValue] = useState(sortOptions[0].value);
  const [month, setMonth] = useState(() => getFinanceToday().slice(0, 7));
  const [dateRange, setDateRange] = useState(() => toMonthDateRange(getFinanceToday().slice(0, 7)));
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
  const paging = useListPaging();
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createFinanceLedgerSupabaseClient()),
    [hasInjectedQueryOptions],
  );
  const selectedSort =
    sortOptions.find((option) => option.value === sortValue)?.sort ??
    sortOptions[0].sort;
  const currentOptions: BuildFinanceLedgerListOptions = {
    academyId,
    search,
    dateRange,
    filters: {
      type: type || undefined,
      source: source || undefined,
      category: category || undefined,
    },
    sort: selectedSort,
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const ledgerListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const entries = useMemo(
    () => ledgerListQuery.data ?? [],
    [ledgerListQuery.data],
  );
  const ledgerPage = useMemo(
    () =>
      buildFinanceLedgerPage(entries, {
        page: paging.page,
        pageSize: paging.pageSize,
      }),
    [entries, paging.page, paging.pageSize],
  );
  const registerMutation = useMutation({
    mutationFn: async (input: RegisterManualLedgerEntryInput) => {
      if (registerManualLedgerEntry) {
        await registerManualLedgerEntry(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await registerManualLedgerEntryApi(supabaseClientState.client, {
        ...input,
        academyId,
      });
    },
    onSuccess: () => {
      setIsManualOpen(false);
      toast.success("수동 입출금을 등록했습니다.");
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("수동 입출금 등록에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (entry: LedgerEntry) => {
      if (updateLedgerEntry) {
        await updateLedgerEntry(entry);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await updateFinanceLedgerEntryApi(supabaseClientState.client, {
        ledgerId: entry.ledgerId,
        academyId: entry.academyId,
        occurredOn: entry.occurredOn,
        type: entry.type,
        source: entry.source,
        category: entry.category ?? toDefaultLedgerCategory(entry.source),
        amount: entry.amount,
        description: entry.description,
      });
    },
    onSuccess: () => {
      setEditingEntry(null);
      toast.success("입출금 내역을 수정했습니다.");
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("입출금 내역 수정에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (entry: LedgerEntry) => {
      if (deleteLedgerEntry) {
        await deleteLedgerEntry({ ledgerId: entry.ledgerId });
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await deleteFinanceLedgerEntryApi(supabaseClientState.client, {
        ledgerId: entry.ledgerId,
        academyId: entry.academyId,
      });
    },
    onSuccess: () => {
      toast.success("입출금 내역을 삭제했습니다.");
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("입출금 내역 삭제에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
    onSettled: () => setDeletingEntry(null),
  });
  const headerActions = useMemo(
    () => (
      <>
        <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
          <DialogTrigger asChild>
            <Button type="button">
              <CircleDollarSign aria-hidden="true" />
              수동 입출금 등록
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>수동 입출금 등록</DialogTitle>
              <DialogDescription>
                자동 수납 외 조정 내역을 직접 기록합니다.
              </DialogDescription>
            </DialogHeader>
            <LedgerEntryForm
              formLabel="수동 입출금 입력"
              submitLabel="저장"
              onSubmit={(input) => {
                registerMutation.mutate({
                  academyId,
                  occurredOn: input.occurredOn,
                  type: input.type,
                  category: input.category,
                  amount: input.amount,
                  description: input.description,
                });
              }}
            />
          </DialogContent>
        </Dialog>
        <Button
          type="button"
          variant="outline"
          onClick={() => downloadFinanceCsv(entries)}
        >
          <Download aria-hidden="true" />
          CSV 내보내기
        </Button>
      </>
    ),
    [academyId, entries, isManualOpen, registerMutation],
  );
  const isHeaderActionMounted = usePageHeaderActions(headerActions);

  /** 검색어·필터·정렬·기간이 바뀌면 보던 페이지가 의미를 잃으므로 1페이지로 돌아간다. */
  function withPageReset<Value>(update: (value: Value) => void) {
    return (value: Value) => {
      update(value);
      paging.resetPage();
    };
  }

  return (
    <section className="grid gap-4" aria-label="입출금 내역">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {headerActions}
      </PageHeaderActionFallback>

      <FinanceLedgerFilters
        category={category}
        dateRange={dateRange}
        month={month}
        search={search}
        sortValue={sortValue}
        source={source}
        type={type}
        onChangeCategory={withPageReset(setCategory)}
        onChangeDateRange={withPageReset(setDateRange)}
        onChangeMonth={(nextMonth) => {
          setMonth(nextMonth);
          setDateRange(toMonthDateRange(nextMonth));
          paging.resetPage();
        }}
        onChangeSearch={withPageReset(setSearch)}
        onChangeSort={withPageReset(setSortValue)}
        onChangeSource={withPageReset(setSource)}
        onChangeType={withPageReset(setType)}
        onReset={() => {
          setSearch("");
          setType("");
          setSource("");
          setCategory("");
          setSortValue(sortOptions[0].value);
          const currentMonth = getFinanceToday().slice(0, 7);
          setMonth(currentMonth);
          setDateRange(toMonthDateRange(currentMonth));
          paging.resetPage();
        }}
      />

      {!hasInjectedQueryOptions && supabaseClientState?.error ? (
        <ListStatusAlert
          message="입출금 내역을 불러오지 못했습니다."
          detail={toUserMessage(supabaseClientState.error)}
        />
      ) : null}

      {ledgerListQuery.isError ? (
        <ListStatusAlert
          message="입출금 내역을 불러오지 못했습니다."
          detail={toUserMessage(ledgerListQuery.error)}
        />
      ) : null}

      <Tabs defaultValue="list" className="gap-3">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
          <TabsTrigger value="list">목록</TabsTrigger>
          <TabsTrigger value="calendar">캘린더</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          {ledgerListQuery.isLoading ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              입출금 내역을 불러오는 중입니다.
            </p>
          ) : null}
          {!ledgerListQuery.isLoading &&
          !ledgerListQuery.isError &&
          (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
            <FinanceLedgerTable
              view={ledgerPage}
              onDelete={setDeletingEntry}
              onEdit={setEditingEntry}
              onPageChange={paging.goToPage}
              onPageSizeChange={paging.changePageSize}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="calendar">
          <FinanceLedgerCalendar month={month} entries={entries} />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editingEntry)} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>입출금 내역 수정</DialogTitle>
            <DialogDescription>
              자동 생성 내역도 수정할 수 있으며 변경 이력은 감사 로그로 남습니다.
            </DialogDescription>
          </DialogHeader>
          {editingEntry ? (
            <LedgerEntryForm
              formLabel="입출금 내역 수정 입력"
              initialEntry={editingEntry}
              submitLabel="수정 저장"
              onSubmit={(input) => {
                updateMutation.mutate({
                  academyId: editingEntry.academyId,
                  ledgerId: editingEntry.ledgerId,
                  refId: editingEntry.refId,
                  occurredOn: input.occurredOn,
                  type: input.type,
                  source: input.source,
                  category: input.category,
                  amount: input.amount,
                  description: input.description,
                });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <LedgerDeleteDialog
        entry={deletingEntry}
        isDeleting={deleteMutation.isPending}
        onConfirm={(entry) => deleteMutation.mutate(entry)}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
      />
    </section>
  );
}

export function FinanceLessonIncomeScreen({
  academyId,
  financeData,
  markTuitionPaid,
  markTuitionUnpaid,
  tuitionSnapshotsQueryOptionsFactory,
}: FinanceDataScreenProps) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => getFinanceToday().slice(0, 7));
  const { search, changeSearch, paging } = useSearchableListPaging();
  const [paymentTarget, setPaymentTarget] = useState<{
    action: "paid" | "unpaid";
    row: LessonIncomeRow;
  } | null>(null);
  const tuitionSnapshotsQuery = useQuery(
    tuitionSnapshotsQueryOptionsFactory?.(month) ??
      createFallbackTuitionSnapshotsQueryOptions(financeData, academyId, month),
  );
  const rows = useMemo(
    () => tuitionSnapshotsQuery.isSuccess
      ? buildLessonIncomeRows(financeData, academyId, month, tuitionSnapshotsQuery.data)
      : [],
    [academyId, financeData, month, tuitionSnapshotsQuery.data, tuitionSnapshotsQuery.isSuccess],
  );
  const rowsView = useMemo(
    () =>
      buildListView(rows, {
        getName: (row) => row.studentName,
        getTieBreaker: getLessonIncomeTieBreaker,
        search,
        searchFields: [(row) => row.studentName, (row) => row.instrumentName],
        page: paging.page,
        pageSize: paging.pageSize,
      }),
    [rows, search, paging.page, paging.pageSize],
  );
  const unpaidRows = useMemo(
    () => rows.filter((row) => row.source === "tuition" && row.status === "unpaid"),
    [rows],
  );
  const unpaidStudentCount = new Set(unpaidRows.map((row) => row.studentId)).size;
  const unpaidAction = useMemo(() => tuitionSnapshotsQuery.isSuccess ? (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <UsersRound aria-hidden="true" />
          미납인원 {unpaidStudentCount}명
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>미납인원</DialogTitle>
          <DialogDescription>{month} 수강료 미납 현황</DialogDescription>
        </DialogHeader>
        {unpaidRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">미납 항목이 없습니다.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {unpaidRows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>{row.studentName} · {row.instrumentName}</span>
                <span className="shrink-0 font-medium">{formatWon(row.finalAmount)}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  ) : null, [month, tuitionSnapshotsQuery.isSuccess, unpaidRows, unpaidStudentCount]);
  const isHeaderActionMounted = usePageHeaderActions(unpaidAction);
  const totalAmount = rows.reduce((total, row) => total + row.finalAmount, 0);
  const markTuitionPaidMutation = useMutation({
    mutationFn: async (input: { row: LessonIncomeRow; paidAt: string }) => {
      if (!markTuitionPaid) {
        return;
      }

      await markTuitionPaid({
        academyId,
        tuitionId: input.row.id,
        paidAt: input.paidAt,
      });
    },
    onSuccess: () => {
      setPaymentTarget(null);
      toast.success("수강료 수납을 처리했습니다.");
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("수강료 수납 처리에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const markTuitionUnpaidMutation = useMutation({
    mutationFn: async (row: LessonIncomeRow) => {
      if (!markTuitionUnpaid) {
        return;
      }

      await markTuitionUnpaid({
        academyId,
        tuitionId: row.id,
      });
    },
    onSuccess: () => {
      setPaymentTarget(null);
      toast.success("수강료 미수납을 처리했습니다.");
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("수강료 미수납 처리에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  return (
    <section className="grid gap-4" aria-label="학원 레슨수입">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {unpaidAction}
      </PageHeaderActionFallback>
      <FinanceMonthSummary
        amount={totalAmount}
        label="월별 전체 레슨수입"
        month={month}
        onChangeMonth={(nextMonth) => {
          setMonth(nextMonth);
          paging.resetPage();
        }}
      />
      <FinanceListSearch
        label="레슨수입 검색"
        placeholder="원생명, 악기"
        value={search}
        onChange={changeSearch}
      />
      {tuitionSnapshotsQuery.isError ? (
        <ListStatusAlert
          message="월별 수강료를 불러오지 못했습니다."
          detail={toUserMessage(tuitionSnapshotsQuery.error)}
        />
      ) : null}
      {tuitionSnapshotsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">월별 수강료를 불러오는 중입니다.</p>
      ) : null}
      <div className="rounded-lg border border-border bg-card">
        {rowsView.items.length > 0 ? (
          <div className="grid gap-2 p-3 xl:hidden" aria-label="학원 레슨수입 간략 목록">
            {rowsView.items.map((row) => (
              <article key={row.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{row.studentName} · {row.instrumentName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{row.lessonKindLabel} · {row.progress}</p>
                  </div>
                  <p className="font-semibold">{formatWon(row.finalAmount)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">
                    레슨비 {formatWon(row.lessonFee)} · 할인 {formatWon(row.discountTotal)}
                  </span>
                  <LessonIncomePaymentAction
                    row={row}
                    onClick={(action) => setPaymentTarget({ action, row })}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : null}
        <div className="hidden overflow-x-auto xl:block">
          <Table aria-label="학원 레슨수입" className="min-w-[60rem]">
            <TableHeader className="bg-muted text-muted-foreground">
              <TableRow>
                <TableHead className="px-4 py-3">이름</TableHead>
                <TableHead className="px-4 py-3">레슨종류</TableHead>
                <TableHead className="px-4 py-3">악기</TableHead>
                <TableHead className="px-4 py-3">진도</TableHead>
                <TableHead className="px-4 py-3">레슨비</TableHead>
                <TableHead className="px-4 py-3">할인</TableHead>
                <TableHead className="px-4 py-3">최종금액</TableHead>
                <TableHead className="px-4 py-3 text-right">수납</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsView.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 py-3 font-medium">{row.studentName}</TableCell>
                  <TableCell className="px-4 py-3">{row.lessonKindLabel}</TableCell>
                  <TableCell className="px-4 py-3">{row.instrumentName}</TableCell>
                  <TableCell className="px-4 py-3">{row.progress}</TableCell>
                  <TableCell className="px-4 py-3">{formatWon(row.lessonFee)}</TableCell>
                  <TableCell className="px-4 py-3">{formatWon(row.discountTotal)}</TableCell>
                  <TableCell className="px-4 py-3 font-semibold">
                    {formatWon(row.finalAmount)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <LessonIncomePaymentAction
                      row={row}
                      onClick={(action) => setPaymentTarget({ action, row })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {tuitionSnapshotsQuery.isSuccess ? (
          <>
            {rowsView.totalItems === 0 ? <EmptyListMessage>조건에 맞는 레슨수입이 없습니다.</EmptyListMessage> : null}
            <ListPagination
              itemLabel="레슨수입"
              countUnit="건"
              view={rowsView}
              onPageChange={paging.goToPage}
              onPageSizeChange={paging.changePageSize}
            />
          </>
        ) : null}
      </div>
      <PaymentDialog
        open={Boolean(paymentTarget)}
        title={paymentTarget?.action === "unpaid" ? "미수납 처리" : "수납 처리"}
        dateLabel="수납일"
        onConfirm={(paidAt) => {
          if (!paymentTarget) {
            return;
          }

          if (paymentTarget.action === "unpaid") {
            markTuitionUnpaidMutation.mutate(paymentTarget.row);
            return;
          }

          markTuitionPaidMutation.mutate({
            row: paymentTarget.row,
            paidAt,
          });
        }}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
      />
    </section>
  );
}

export function FinanceBooksScreen({
  academyId,
  financeData,
}: FinanceDataScreenProps) {
  const { search, changeSearch, paging } = useSearchableListPaging();
  const rows = useMemo(
    () => buildBookFinanceRows(financeData.bookSales, academyId),
    [academyId, financeData.bookSales],
  );
  const rowsView = useMemo(
    () =>
      buildListView(rows, {
        getName: (row) => row.studentName,
        getTieBreaker: getBookFinanceTieBreaker,
        search,
        searchFields: [(row) => row.studentName, (row) => row.bookTitle],
        page: paging.page,
        pageSize: paging.pageSize,
      }),
    [rows, search, paging.page, paging.pageSize],
  );

  return (
    <section className="grid gap-4" aria-label="교재내역">
      <FinanceListSearch
        label="교재내역 검색"
        placeholder="원생명, 교재명"
        value={search}
        onChange={changeSearch}
      />
      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table aria-label="교재내역" className="min-w-[48rem]">
            <TableHeader className="bg-muted text-muted-foreground">
              <TableRow>
                <TableHead className="px-4 py-3">원생</TableHead>
                <TableHead className="px-4 py-3">교재명</TableHead>
                <TableHead className="px-4 py-3">금액</TableHead>
                <TableHead className="px-4 py-3">발주일</TableHead>
                <TableHead className="px-4 py-3">출고일</TableHead>
                <TableHead className="px-4 py-3">입금일</TableHead>
                <TableHead className="px-4 py-3">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsView.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 py-3 font-medium">{row.studentName}</TableCell>
                  <TableCell className="px-4 py-3">{row.bookTitle}</TableCell>
                  <TableCell className="px-4 py-3">{formatWon(row.amount)}</TableCell>
                  <TableCell className="px-4 py-3">{row.orderedOn || "-"}</TableCell>
                  <TableCell className="px-4 py-3">{row.shippedAt}</TableCell>
                  <TableCell className="px-4 py-3">{row.paidAt || "-"}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={row.status === "paid" ? "secondary" : "outline"}>
                      {row.status === "paid" ? "입금 완료" : "입금 대기"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rowsView.totalItems === 0 ? <EmptyListMessage>조건에 맞는 교재내역이 없습니다.</EmptyListMessage> : null}
        <ListPagination
          itemLabel="교재내역"
          countUnit="건"
          view={rowsView}
          onPageChange={paging.goToPage}
          onPageSizeChange={paging.changePageSize}
        />
      </div>
    </section>
  );
}

export function FinancePayrollScreen({
  academyId,
  financeData,
  markPayrollPaid,
}: FinanceDataScreenProps) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => getFinanceToday().slice(0, 7));
  const { search, changeSearch, paging } = useSearchableListPaging();
  const [paymentTarget, setPaymentTarget] = useState<PayrollRecord | null>(null);
  // 급여는 선생님 전체로 계산하고, 검색과 페이지는 표에 보여 줄 행만 고른다.
  const rows = useMemo(
    () => buildPayrollRows(financeData, academyId, month),
    [academyId, financeData, month],
  );
  const rowsView = useMemo(
    () =>
      buildListView(rows, {
        getName: (row) => row.teacherName,
        getTieBreaker: (row) => row.payrollId,
        search,
        page: paging.page,
        pageSize: paging.pageSize,
      }),
    [rows, search, paging.page, paging.pageSize],
  );
  const totalNetPay = rows.reduce((total, row) => total + row.netPay, 0);
  const markPayrollPaidMutation = useMutation({
    mutationFn: async (input: { payroll: PayrollRecord; paidAt: string }) => {
      if (!markPayrollPaid) {
        return;
      }

      await markPayrollPaid({
        academyId,
        payroll: input.payroll,
        paidAt: input.paidAt,
      });
    },
    onSuccess: () => {
      setPaymentTarget(null);
      toast.success("급여 지급을 확정했습니다.");
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("급여 지급 확정에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  return (
    <section className="grid gap-4" aria-label="선생님 월급">
      <FinanceMonthSummary
        amount={totalNetPay}
        label="월별 지급 예정 급여"
        month={month}
        onChangeMonth={(nextMonth) => {
          setMonth(nextMonth);
          paging.resetPage();
        }}
      />
      <FinanceListSearch
        label="선생님 월급 검색"
        placeholder="선생님 이름"
        value={search}
        onChange={changeSearch}
      />
      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table aria-label="선생님 월급" className="min-w-[54rem]">
            <TableHeader className="bg-muted text-muted-foreground">
              <TableRow>
                <TableHead className="px-4 py-3">선생님</TableHead>
                <TableHead className="px-4 py-3">급여유형</TableHead>
                <TableHead className="px-4 py-3">기본급여</TableHead>
                <TableHead className="px-4 py-3">원천징수</TableHead>
                <TableHead className="px-4 py-3">최종지급액</TableHead>
                <TableHead className="px-4 py-3 text-right">지급</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsView.items.map((row) => (
                <TableRow key={row.payrollId}>
                  <TableCell className="px-4 py-3 font-medium">{row.teacherName}</TableCell>
                  <TableCell className="px-4 py-3">{formatPayType(row.payType)}</TableCell>
                  <TableCell className="px-4 py-3">{formatWon(row.basePay)}</TableCell>
                  <TableCell className="px-4 py-3">{formatWon(row.withholdingTax)}</TableCell>
                  <TableCell className="px-4 py-3 font-semibold">{formatWon(row.netPay)}</TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {row.status === "paid" ? (
                      <Badge variant="secondary">지급 완료</Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        aria-label={`${row.teacherName} 급여 지급 확정`}
                        onClick={() => setPaymentTarget(row)}
                      >
                        지급 확정
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rowsView.totalItems === 0 ? <EmptyListMessage>조건에 맞는 선생님이 없습니다.</EmptyListMessage> : null}
        <ListPagination
          itemLabel="선생님 월급"
          countUnit="명"
          view={rowsView}
          onPageChange={paging.goToPage}
          onPageSizeChange={paging.changePageSize}
        />
      </div>
      <PaymentDialog
        open={Boolean(paymentTarget)}
        title="급여 지급 확정"
        dateLabel="지급일"
        onConfirm={(paidAt) => {
          if (!paymentTarget) {
            return;
          }

          markPayrollPaidMutation.mutate({
            payroll: paymentTarget,
            paidAt,
          });
        }}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
      />
    </section>
  );
}

export function FinanceOverviewScreen({
  academyId,
  financeData,
  initialYear,
}: FinanceDataScreenProps & { initialYear?: number }) {
  const [year, setYear] = useState(() => initialYear ?? Number(getFinanceToday().slice(0, 4)));
  const yearIncomeEntries = financeData.ledgerEntries.filter(
    (entry) =>
      entry.type === "income" &&
      entry.academyId === academyId &&
      entry.occurredOn.startsWith(`${year}-`),
  );
  const graph = buildIncomeExpenseGraph(financeData.ledgerEntries, { academyId, year });
  const categoryTotals = buildIncomeCategoryTotals(yearIncomeEntries);
  const monthlyTotals = graph.months.map((month) => ({
    month: month.month,
    income: month.totalInstrumentIncome + month.academyIncome,
    expense: month.expense,
    netIncome: month.netIncome,
  }));
  const yearTotal = {
    income: sumOf(monthlyTotals, "income"),
    expense: sumOf(monthlyTotals, "expense"),
    netIncome: sumOf(monthlyTotals, "netIncome"),
  };
  const maxMonthlyAmount = Math.max(
    1,
    ...monthlyTotals.flatMap((month) => [month.income, month.expense]),
  );

  return (
    <section className="grid gap-4" aria-label="전체수입">
      <div className="rounded-lg border border-border bg-card p-4">
        <Label className="grid max-w-40 gap-1 text-sm font-medium">
          <span>연도</span>
          <Input
            aria-label="전체수입 연도"
            type="number"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </Label>
      </div>
      <section aria-label="연간 요약" className="grid gap-2 sm:grid-cols-3">
        <OverviewTotal label="수입" amount={yearTotal.income} />
        <OverviewTotal label="지출" amount={yearTotal.expense} />
        <OverviewTotal label="순수익" amount={yearTotal.netIncome} emphasized />
      </section>
      <figure
        aria-label="월별 수입·지출 그래프"
        className="grid gap-2 rounded-lg border border-border bg-card p-4"
      >
        <figcaption className="text-base font-semibold">월별 수입·지출 비교</figcaption>
        <div className="grid gap-3">
          {monthlyTotals.map((month) => (
            <div key={month.month} role="group" aria-label={month.month} className="grid gap-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                <span className="font-medium">{month.month}</span>
                <span className="text-muted-foreground">
                  수입 {formatWon(month.income)} · 지출 {formatWon(month.expense)} ·{" "}
                  <span className="font-medium text-foreground">순수익 {formatWon(month.netIncome)}</span>
                </span>
              </div>
              <OverviewBar amount={month.income} max={maxMonthlyAmount} className="bg-primary" />
              <OverviewBar amount={month.expense} max={maxMonthlyAmount} className="bg-destructive/70" />
            </div>
          ))}
        </div>
      </figure>
      <section aria-label="분류별 수입" className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold">분류별 수입</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categoryTotals.map((item) => (
            <div key={item.category} className="rounded-md border border-border p-3">
              <p className="text-sm text-muted-foreground">
                {formatLedgerCategory(item.category)}
              </p>
              <p className="mt-1 text-lg font-semibold">{formatWon(item.amount)}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function OverviewTotal({
  label,
  amount,
  emphasized = false,
}: {
  label: string;
  amount: number;
  emphasized?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={emphasized ? "mt-1 text-2xl font-semibold" : "mt-1 text-xl font-semibold"}>
        {formatWon(amount)}
      </p>
    </div>
  );
}

function OverviewBar({ amount, max, className }: { amount: number; max: number; className: string }) {
  return (
    <div className="h-2 rounded-sm bg-muted" aria-hidden="true">
      <div
        className={`h-2 rounded-sm ${className}`}
        style={{ width: amount > 0 ? `${Math.max(4, (amount / max) * 100)}%` : "0%" }}
      />
    </div>
  );
}

function sumOf<Key extends string>(rows: Array<Record<Key, number>>, key: Key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function FinanceLedgerFilters({
  category,
  dateRange,
  month,
  search,
  sortValue,
  source,
  type,
  onChangeCategory,
  onChangeDateRange,
  onChangeMonth,
  onChangeSearch,
  onChangeSort,
  onChangeSource,
  onChangeType,
  onReset,
}: {
  category: LedgerCategory | "";
  dateRange: { from: string; to: string };
  month: string;
  search: string;
  sortValue: string;
  source: LedgerEntry["source"] | "";
  type: LedgerEntry["type"] | "";
  onChangeCategory: (category: LedgerCategory | "") => void;
  onChangeDateRange: (dateRange: { from: string; to: string }) => void;
  onChangeMonth: (month: string) => void;
  onChangeSearch: (search: string) => void;
  onChangeSort: (sortValue: string) => void;
  onChangeSource: (source: LedgerEntry["source"] | "") => void;
  onChangeType: (type: LedgerEntry["type"] | "") => void;
  onReset: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(12rem,1fr)_9rem_9rem_9rem_9rem_auto]">
      <ListSearchField
        label="입출금 내역 검색"
        value={search}
        onChange={onChangeSearch}
        placeholder="발생일, 설명, 유형, 출처, 분류"
      />
      <Label className="grid gap-1 text-sm font-medium">
        <span>월 선택</span>
        <MonthField
          aria-label="입출금 월 선택"
          required
          value={month}
          onValueChange={onChangeMonth}
        />
      </Label>
      <ListFilterSelect
        label="유형 필터"
        value={type}
        options={typeFilterOptions}
        onChange={(nextType) => onChangeType(nextType as LedgerEntry["type"] | "")}
      />
      <ListFilterSelect
        label="출처 필터"
        value={source}
        options={sourceFilterOptions}
        onChange={(nextSource) =>
          onChangeSource(nextSource as LedgerEntry["source"] | "")
        }
      />
      <ListFilterSelect
        label="분류 필터"
        value={category}
        options={ledgerCategoryOptions}
        onChange={(nextCategory) =>
          onChangeCategory(nextCategory as LedgerCategory | "")
        }
      />
      <Button
        type="button"
        variant="outline"
        className="self-end"
        onClick={onReset}
      >
        <RotateCcw aria-hidden="true" />
        초기화
      </Button>
      <div className="grid gap-3 lg:col-span-6 lg:grid-cols-[9rem_9rem_11rem]">
        <Label className="grid gap-1 text-sm font-medium">
          <span>시작일</span>
          <DateField
            aria-label="입출금 시작일"
            value={dateRange.from}
            onValueChange={(nextValue) =>
              onChangeDateRange({ ...dateRange, from: nextValue })
            }
          />
        </Label>
        <Label className="grid gap-1 text-sm font-medium">
          <span>종료일</span>
          <DateField
            aria-label="입출금 종료일"
            value={dateRange.to}
            onValueChange={(nextValue) =>
              onChangeDateRange({ ...dateRange, to: nextValue })
            }
          />
        </Label>
        <Label className="grid gap-1 text-sm font-medium">
          <span>정렬</span>
          <NativeSelect
            aria-label="입출금 정렬"
            value={sortValue}
            onChange={(event) => onChangeSort(event.target.value)}
          >
            {sortOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </div>
    </div>
  );
}

function LedgerEntryForm({
  formLabel,
  initialEntry,
  submitLabel,
  onSubmit,
}: {
  formLabel: string;
  initialEntry?: LedgerEntry;
  submitLabel: string;
  onSubmit: (input: LedgerDraft) => void;
}) {
  const [draft, setDraft] = useState<LedgerDraft>(() => ({
    ledgerId: initialEntry?.ledgerId,
    occurredOn: initialEntry?.occurredOn ?? getFinanceToday(),
    type: initialEntry?.type ?? "income",
    source: initialEntry?.source ?? "manual",
    category:
      initialEntry?.category ?? toDefaultLedgerCategory(initialEntry?.source ?? "manual"),
    amount: initialEntry?.amount ?? 0,
    description: initialEntry?.description ?? "",
  }));
  const canSubmit =
    Boolean(draft.occurredOn) &&
    Number.isInteger(draft.amount) &&
    draft.amount > 0 &&
    Boolean(draft.description.trim());

  return (
    <form
      aria-label={formLabel}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({
          ...draft,
          description: draft.description.trim(),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>발생일</span>
          <DateField
            aria-label="발생일"
            value={draft.occurredOn}
            onValueChange={(nextValue) =>
              setDraft((current) => ({
                ...current,
                occurredOn: nextValue,
              }))
            }
          />
        </Label>
        <Label className="grid gap-1">
          <span>유형</span>
          <NativeSelect
            aria-label="유형"
            value={draft.type}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                type: event.target.value as LedgerEntry["type"],
              }))
            }
          >
            <NativeSelectOption value="income">수입</NativeSelectOption>
            <NativeSelectOption value="expense">지출</NativeSelectOption>
          </NativeSelect>
        </Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>출처</span>
          <NativeSelect
            aria-label="출처"
            value={draft.source}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                source: event.target.value as LedgerEntry["source"],
              }))
            }
          >
            {sourceFilterOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>고정 분류</span>
          <NativeSelect
            aria-label="고정 분류"
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as LedgerCategory,
              }))
            }
          >
            {ledgerCategoryOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </div>
      <Label className="grid gap-1">
        <span>금액</span>
        <Input
          aria-label="금액"
          type="number"
          min={1}
          step={1}
          value={draft.amount}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              amount: Number(event.target.value),
            }))
          }
        />
      </Label>
      <Label className="grid gap-1">
        <span>설명</span>
        <Input
          aria-label="설명"
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </Label>
      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FinanceLedgerTable({
  view,
  onDelete,
  onEdit,
  onPageChange,
  onPageSizeChange,
}: {
  view: ListView<LedgerEntry>;
  onDelete: (entry: LedgerEntry) => void;
  onEdit: (entry: LedgerEntry) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSizeOption) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      {view.items.length === 0 ? (
        <EmptyListMessage>조건에 맞는 입출금 내역이 없습니다.</EmptyListMessage>
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="입출금 내역" className="min-w-[56rem]">
            <TableHeader className="bg-muted text-muted-foreground">
              <TableRow>
                <TableHead className="px-4 py-3">발생일</TableHead>
                <TableHead className="px-4 py-3">유형</TableHead>
                <TableHead className="px-4 py-3">출처</TableHead>
                <TableHead className="px-4 py-3">분류</TableHead>
                <TableHead className="px-4 py-3">금액</TableHead>
                <TableHead className="px-4 py-3">설명</TableHead>
                <TableHead className="px-4 py-3 text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.items.map((entry) => (
                <TableRow key={entry.ledgerId}>
                  <TableCell className="px-4 py-3">{entry.occurredOn}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={entry.type === "income" ? "secondary" : "outline"}>
                      {formatLedgerEntryType(entry.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {formatLedgerEntrySource(entry.source)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {formatLedgerCategory(entry.category)}
                  </TableCell>
                  <TableCell className="px-4 py-3">{formatWon(entry.amount)}</TableCell>
                  <TableCell className="px-4 py-3 font-medium">
                    {entry.description}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${entry.description} 수정`}
                        onClick={() => onEdit(entry)}
                      >
                        <Pencil aria-hidden="true" />
                        수정
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${entry.description} 삭제`}
                        onClick={() => onDelete(entry)}
                      >
                        <Trash2 aria-hidden="true" />
                        삭제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ListPagination
        itemLabel="입출금 내역"
        countUnit="건"
        view={view}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

function LedgerDeleteDialog({
  entry,
  isDeleting,
  onConfirm,
  onOpenChange,
}: {
  entry: LedgerEntry | null;
  isDeleting: boolean;
  onConfirm: (entry: LedgerEntry) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이 입출금 내역을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            삭제하면 되돌릴 수 없습니다. 수강료·교재·급여로 자동 기록된 내역은 원래
            기록과의 연결이 끊어질 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {entry ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
            {entry.occurredOn} · {entry.description} · {formatWon(entry.amount)}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting || !entry}
            onClick={(event) => {
              event.preventDefault();

              if (entry) {
                onConfirm(entry);
              }
            }}
          >
            {isDeleting ? "삭제 중" : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FinanceLedgerCalendar({
  entries,
  month,
}: {
  entries: LedgerEntry[];
  month: string;
}) {
  const calendarDays = buildFinanceCalendarDays(entries, {
    academyId: entries[0]?.academyId ?? "",
    month,
  });
  const [year, monthIndex] = month.split("-").map(Number);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div
        role="grid"
        aria-label={`${year}년 ${monthIndex}월 입출금 캘린더`}
        className="grid grid-cols-7 gap-1 sm:gap-2"
      >
        {calendarDays.map((day) => (
          <div
            key={day.date}
            role="gridcell"
            className="min-h-24 rounded-md border border-border bg-background p-2"
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {Number(day.date.slice(-2))}
            </p>
            {day.income > 0 ? (
              <p className="mt-2 text-xs font-medium text-blue-600">
                +{formatWon(day.income)}
              </p>
            ) : null}
            {day.expense > 0 ? (
              <p className="text-xs font-medium text-destructive">
                -{formatWon(day.expense)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceMonthSummary({
  amount,
  label,
  month,
  onChangeMonth,
}: {
  amount: number;
  label: string;
  month: string;
  onChangeMonth: (month: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{formatWon(amount)}</p>
      </div>
      <Label className="grid gap-1 text-sm font-medium sm:min-w-44">
        <span>월 선택</span>
        <MonthField
          aria-label={`${label} 월 선택`}
          required
          value={month}
          onValueChange={onChangeMonth}
        />
      </Label>
    </div>
  );
}

function FinanceListSearch({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:max-w-md">
      <ListSearchField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

function EmptyListMessage({ children }: { children: string }) {
  return <p className="p-4 text-sm text-muted-foreground">{children}</p>;
}

/** 이름 검색이 있는 표의 상태. 검색어가 바뀌면 보던 페이지가 의미를 잃으므로 1페이지로 돌아간다. */
function useSearchableListPaging() {
  const [search, setSearch] = useState("");
  const paging = useListPaging();
  const { resetPage } = paging;

  const changeSearch = useCallback(
    (nextSearch: string) => {
      setSearch(nextSearch);
      resetPage();
    },
    [resetPage],
  );

  return { search, changeSearch, paging };
}

function LessonIncomePaymentAction({
  row,
  onClick,
}: {
  row: LessonIncomeRow;
  onClick: (action: "paid" | "unpaid") => void;
}) {
  if (row.source === "lesson-ticket") {
    return <Badge variant="secondary">수납 완료</Badge>;
  }

  const nextAction = row.status === "paid" ? "unpaid" : "paid";

  return (
    <Button
      type="button"
      size="sm"
      variant={nextAction === "unpaid" ? "outline" : "default"}
      aria-label={`${row.studentName} ${
        nextAction === "unpaid" ? "미수납 처리" : "수납 처리"
      }`}
      onClick={() => onClick(nextAction)}
    >
      {nextAction === "unpaid" ? "미수납" : "수납"}
    </Button>
  );
}

function PaymentDialog({
  dateLabel,
  onConfirm,
  open,
  title,
  onOpenChange,
}: {
  dateLabel: string;
  onConfirm: (paidAt: string) => void;
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            확인하면 연결된 입출금 내역이 자동으로 기록됩니다.
          </DialogDescription>
        </DialogHeader>
        <PaymentDateForm
          dateLabel={dateLabel}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** 다이얼로그가 열릴 때마다 새로 마운트되어 수납일이 항상 오늘로 시작한다. */
function PaymentDateForm({
  dateLabel,
  onConfirm,
  onCancel,
}: {
  dateLabel: string;
  onConfirm: (paidAt: string) => void;
  onCancel: () => void;
}) {
  const [paidAt, setPaidAt] = useState(getFinanceToday);

  return (
    <>
      <Label className="grid gap-1 text-sm font-medium">
        <span>{dateLabel}</span>
        <DateField aria-label={dateLabel} value={paidAt} onValueChange={setPaidAt} />
      </Label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="button" onClick={() => onConfirm(paidAt)}>
          확인
        </Button>
      </DialogFooter>
    </>
  );
}

function createDefaultQueryOptions(
  options: BuildFinanceLedgerListOptions,
  supabaseClientState: SupabaseClientState,
): FinanceLedgerListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.finance.ledgerList(options.academyId, {
        q: options.search,
        type: options.filters?.type,
        source: options.filters?.source,
        category: options.filters?.category,
        from: options.dateRange?.from,
        to: options.dateRange?.to,
        sort: options.sort ? `${options.sort.field}-${options.sort.direction}` : "",
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createFinanceLedgerListQueryOptions(
    supabaseClientState.client,
    options,
  );
}

function createFinanceLedgerSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as FinanceLedgerSupabaseClient,
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

function buildLessonIncomeRows(
  data: FinanceManagementData,
  academyId: string,
  month: string,
  tuitionSnapshots?: TuitionRecord[],
): LessonIncomeRow[] {
  const academyRows = (
    tuitionSnapshots ?? buildFallbackTuitionSnapshots(data, academyId, month)
  ).map((snapshot) => ({
    id: snapshot.tuitionId,
    studentId: snapshot.studentId,
    source: "tuition" as const,
    studentName: snapshot.studentName,
    lessonKindLabel: "학원레슨 월수강료" as const,
    instrumentName: snapshot.instrumentName,
    progress: snapshot.progress,
    lessonFee: snapshot.lessonFee,
    discountTotal: snapshot.discountTotal,
    finalAmount: snapshot.amount,
    status: snapshot.status,
    paidAt: snapshot.paidAt,
  }));
  const privateRows = data.tickets
    .filter(
      (ticket) =>
        ticket.academyId === academyId && ticket.registeredAt.startsWith(month),
    )
    .map((ticket) => ({
      id: `ticket:${ticket.ticketId}`,
      studentId: ticket.studentId,
      source: "lesson-ticket" as const,
      studentName: ticket.studentName,
      lessonKindLabel: "개인레슨 회차권" as const,
      instrumentName: ticket.instrumentName,
      progress: "회차권",
      lessonFee: ticket.paidAmount ?? 0,
      discountTotal: 0,
      finalAmount: ticket.paidAmount ?? 0,
      status: "paid" as const,
      paidAt: ticket.paidAt ?? ticket.registeredAt,
    }));

  return [...academyRows, ...privateRows].sort(
    (left, right) =>
      compareKoreanNames(left.studentName, right.studentName) ||
      compareKoreanNames(getLessonIncomeTieBreaker(left), getLessonIncomeTieBreaker(right)),
  );
}

/** 이름이 같은 원생은 악기 순서, 그다음 id로 순서를 고정한다. */
function getLessonIncomeTieBreaker(row: LessonIncomeRow) {
  return `${row.instrumentName} ${row.id}`;
}

function createFallbackTuitionSnapshotsQueryOptions(
  data: FinanceManagementData,
  academyId: string,
  month: string,
) {
  return {
    queryKey: [...queryKeys.finance.all(academyId), "tuition-snapshots", month, "fallback"] as const,
    queryFn: async () => buildFallbackTuitionSnapshots(data, academyId, month),
  };
}

function buildFallbackTuitionSnapshots(
  data: FinanceManagementData,
  academyId: string,
  month: string,
) {
  return createMonthlyTuitionSnapshot(
    data.enrollments.map((enrollment) => ({
      academyId: enrollment.academyId,
      studentId: enrollment.studentId,
      studentName: enrollment.studentName,
      enrollmentId: enrollment.enrollmentId,
      instrumentId: enrollment.instrumentId,
      instrumentName: enrollment.instrumentName,
      monthlyAmount: enrollment.finalMonthlyFee,
      registeredOn: `${month}-01`,
      lessonFee: enrollment.lessonFee,
      discountTotal: enrollment.discountTotal,
      discountLabel: enrollment.discountLabel,
      progress: enrollment.progress,
      effectiveFrom: month,
      active: enrollment.lessonType === "academy" && enrollment.active,
    })),
    { academyId, month },
  );
}

function buildBookFinanceRows(
  sales: BookSale[],
  academyId: string,
): BookFinanceRow[] {
  return sales
    .filter((sale) => sale.academyId === academyId)
    .map((sale) => ({
      id: sale.saleId,
      studentName: sale.studentName,
      bookTitle: sale.bookTitle,
      amount: sale.price,
      orderedOn: sale.orderedOn ?? "",
      shippedAt: sale.shippedAt,
      paidAt: sale.status === "paid" ? sale.paidAt : "",
      status: sale.status,
    }));
}

/** 이름이 같은 원생은 출고일이 이른 순서, 그다음 id로 순서를 고정한다. */
function getBookFinanceTieBreaker(row: BookFinanceRow) {
  return `${row.shippedAt} ${row.id}`;
}

function buildPayrollRows(
  data: FinanceManagementData,
  academyId: string,
  month: string,
): PayrollRecord[] {
  const lessonRevenues = buildCompletedLessonRevenues(
    data.payrollLessonSources ?? toPayrollLessonSources(data, academyId),
    { academyId, month },
  );

  return data.teachers
    .filter((teacher) => teacher.academyId === academyId)
    .map((teacher) => {
      const paidSettlement = data.salarySettlements?.find(
        (settlement) =>
          settlement.academyId === academyId &&
          settlement.teacherId === teacher.teacherId &&
          settlement.month === month &&
          settlement.payType === teacher.payType &&
          settlement.status === "paid",
      );

      return paidSettlement ?? buildPayrollRow({
        teacher,
        academyId,
        month,
        lessonRevenues,
      });
    });
}

function buildPayrollRow({
  academyId,
  lessonRevenues,
  month,
  teacher,
}: {
  academyId: string;
  lessonRevenues: ReturnType<typeof buildCompletedLessonRevenues>;
  month: string;
  teacher: TeacherListRow;
}) {
  if (teacher.payType === "monthly") {
    return calculateMonthlyPayroll({
      academyId,
      teacherId: teacher.teacherId,
      teacherName: teacher.name,
      month,
      monthlySalary: teacher.monthlySalary ?? 0,
      withholdingTaxRate,
      rounding: "floor",
    });
  }

  if (teacher.payType === "hourly") {
    return buildHourlyPayrollRow({ academyId, lessonRevenues, month, teacher });
  }

  return calculateRatioPayroll(
    {
      academyId,
      teacherId: teacher.teacherId,
      teacherName: teacher.name,
      month,
      academyShareRatio: 100 - (teacher.ratioTeacherShare ?? 0),
      teacherShareRatio: teacher.ratioTeacherShare ?? 0,
      withholdingTaxRate,
      rounding: "floor",
    },
    lessonRevenues,
  );
}

function buildHourlyPayrollRow({
  academyId,
  lessonRevenues,
  month,
  teacher,
}: {
  academyId: string;
  lessonRevenues: ReturnType<typeof buildCompletedLessonRevenues>;
  month: string;
  teacher: TeacherListRow;
}) {
  const workedHours = lessonRevenues
    .filter((lesson) => lesson.teacherId === teacher.teacherId)
    .reduce((total, lesson) => total + (lesson.durationHours ?? 0), 0);

  if (workedHours <= 0 || !teacher.hourlyRate) {
    return buildEmptyPayrollRow({ academyId, month, teacher });
  }

  return calculateHourlyPayroll({
    academyId,
    teacherId: teacher.teacherId,
    teacherName: teacher.name,
    month,
    hourlyRate: teacher.hourlyRate,
    workedHours,
    withholdingTaxRate,
    rounding: "floor",
  });
}

function buildEmptyPayrollRow({
  academyId,
  month,
  teacher,
}: {
  academyId: string;
  month: string;
  teacher: TeacherListRow;
}): PayrollRecord {
  return {
    academyId,
    payrollId: `${month}:${teacher.teacherId}`,
    teacherId: teacher.teacherId,
    teacherName: teacher.name,
    month,
    payType: teacher.payType,
    basePay: 0,
    withholdingTax: 0,
    netPay: 0,
    status: "pending",
    lessonEventIds: [],
  };
}

function toPayrollLessonSources(
  data: FinanceManagementData,
  academyId: string,
): PayrollLessonSource[] {
  return Object.values(data.academySheets ?? {}).flatMap((sheet) =>
    sheet.rows
      .filter((row) => row.academyId === academyId && row.teacherId)
      .map((row) => {
        const enrollment = data.enrollments.find(
          (candidate) =>
            candidate.studentId === row.studentId &&
            candidate.instrumentId === row.instrumentId,
        );

        return {
          academyId: row.academyId,
          lessonEventId: row.lessonEventId,
          teacherId: row.teacherId ?? "",
          studentId: row.studentId,
          studentName: row.studentName,
          instrumentName: row.instrumentName,
          lessonKind: row.origin === "makeup" ? "makeup" : "academy",
          status: row.status,
          startedAt: `${row.date}T${row.startTime}:00+09:00`,
          endedAt: `${row.date}T${row.endTime}:00+09:00`,
          monthlyLessonFee: enrollment?.finalMonthlyFee ?? 0,
        };
      }),
  );
}

function buildIncomeCategoryTotals(entries: LedgerEntry[]) {
  const totals = new Map<LedgerCategory, number>();

  for (const entry of entries) {
    const category = entry.category ?? toDefaultLedgerCategory(entry.source);
    totals.set(category, (totals.get(category) ?? 0) + entry.amount);
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function toMonthDateRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function invalidateFinanceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  academyId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.finance.all(academyId),
  });
}

function downloadFinanceCsv(entries: LedgerEntry[]) {
  if (typeof document === "undefined") {
    return;
  }

  const blob = new Blob([exportFinanceLedgerCsv(entries)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "finance-ledger.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatPayType(payType: PayrollRecord["payType"]) {
  const labels: Record<PayrollRecord["payType"], string> = {
    monthly: "월급제",
    hourly: "시급제",
    ratio: "비율제",
  };

  return labels[payType];
}

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}
