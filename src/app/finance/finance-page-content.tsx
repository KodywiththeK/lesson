"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { ListStatusAlert } from "@/components/management/list-controls";
import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import {
  FinanceBooksScreen,
  FinanceLedgerListScreen,
  FinanceLessonIncomeScreen,
  FinanceOverviewScreen,
  FinancePayrollScreen,
  type FinanceManagementData,
} from "@/features/finance/finance-management-screens";
import { readFreshData, useFinanceMonth } from "@/features/finance/finance-shared";
import { toUserMessage } from "@/lib/errors/user-message";
import { createFinanceLedgerListQueryOptions } from "@/lib/api/finance";
import { bookOrderQueryKey, fetchBookOrders, type BookOrderReadClient } from "@/lib/api/book-orders";
import {
  cancelPayrollSettlementPaid,
  createMonthlyTuitionSnapshotsQueryOptions,
  createYearlyTuitionSnapshotsQueryOptions,
  fetchFinanceManagementData,
  markMonthlyTuitionAsOverdue,
  markMonthlyTuitionAsPaid,
  markMonthlyTuitionAsUnpaid,
  markPayrollSettlementAsPaid,
  type FinanceManagementSupabaseClient,
} from "@/lib/api/finance-management";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { AppShell } from "../app-shell";

type FinanceScreen =
  | "ledger"
  | "lesson-income"
  | "books"
  | "payroll"
  | "overview";

type FinancePageContentProps = {
  screen: FinanceScreen;
};

export function FinancePageContent({ screen }: FinancePageContentProps) {
  const demo = useDemoAcademy();
  const useTestDemo =
    process.env.NODE_ENV === "test" ||
    process.env.NEXT_PUBLIC_E2E_DEMO === "1";

  return (
    <AcademySessionGate>
      {(academy) => (
        <AppShell
          academyName={academy.academyName}
          permissionContext={academy.permissionContext}
          pageTitle="수입 관리"
        >
          {renderFinanceScreen(screen, {
            academyId: academy.academyId,
            academyName: academy.academyName,
            demo,
            useTestDemo,
          })}
        </AppShell>
      )}
    </AcademySessionGate>
  );
}

function renderFinanceScreen(
  screen: FinanceScreen,
  context: {
    academyId: string;
    academyName: string;
    demo: ReturnType<typeof useDemoAcademy>;
    useTestDemo: boolean;
  },
) {
  if (screen === "ledger") {
    return (
      <FinanceLedgerListScreen
        academyId={context.academyId}
        academyName={context.academyName}
        queryOptionsFactory={
          context.useTestDemo
            ? context.demo.createFinanceLedgerListQueryOptions
            : undefined
        }
        registerManualLedgerEntry={
          context.useTestDemo ? context.demo.registerManualLedgerEntry : undefined
        }
        updateLedgerEntry={
          context.useTestDemo ? context.demo.updateLedgerEntry : undefined
        }
        deleteLedgerEntry={
          context.useTestDemo ? context.demo.deleteLedgerEntry : undefined
        }
      />
    );
  }

  const fallbackData = context.demo.state;

  if (screen === "lesson-income") {
    return (
      <FinanceDataScreen
        academyId={context.academyId}
        fallbackData={fallbackData}
        useTestDemo={context.useTestDemo}
      >
        {(financeData, client) => (
          <FinanceLessonIncomeScreen
            academyId={context.academyId}
            financeData={financeData}
            markTuitionPaid={
              client
                ? (input) => markMonthlyTuitionAsPaid(client, input)
                : undefined
            }
            markTuitionUnpaid={
              client
                ? (input) => markMonthlyTuitionAsUnpaid(client, input)
                : undefined
            }
            markTuitionOverdue={
              client
                ? (input) => markMonthlyTuitionAsOverdue(client, input)
                : undefined
            }
            tuitionSnapshotsQueryOptionsFactory={
              client
                ? (month) =>
                    createMonthlyTuitionSnapshotsQueryOptions(client, {
                      academyId: context.academyId,
                      month,
                    })
                : undefined
            }
          />
        )}
      </FinanceDataScreen>
    );
  }

  if (screen === "books") {
    return (
      <FinanceDataScreen
        academyId={context.academyId}
        fallbackData={fallbackData}
        useTestDemo={context.useTestDemo}
      >
        {(financeData, client) => (
          <FinanceBooksScreen
            academyId={context.academyId}
            financeData={financeData}
            bookOrdersQueryOptions={client ? {
              queryKey: bookOrderQueryKey(context.academyId),
              queryFn: () => fetchBookOrders(client as unknown as BookOrderReadClient, context.academyId),
            } : undefined}
          />
        )}
      </FinanceDataScreen>
    );
  }

  if (screen === "payroll") {
    return (
      <FinanceDataScreen
        academyId={context.academyId}
        fallbackData={fallbackData}
        useTestDemo={context.useTestDemo}
      >
        {(financeData, client, refetchFinanceData) => (
          <FinancePayrollScreen
            academyId={context.academyId}
            financeData={financeData}
            refetchFinanceData={refetchFinanceData}
            markPayrollPaid={
              client
                ? (input) => markPayrollSettlementAsPaid(client, input)
                : undefined
            }
            cancelPayrollPaid={
              client
                ? (input) => cancelPayrollSettlementPaid(client, input)
                : undefined
            }
          />
        )}
      </FinanceDataScreen>
    );
  }

  return (
    <FinanceDataScreen
      academyId={context.academyId}
      fallbackData={fallbackData}
      needsManagementData={false}
      useTestDemo={context.useTestDemo}
    >
      {(financeData, client) => (
        <FinanceOverviewScreen
          academyId={context.academyId}
          financeData={financeData}
          tuitionSnapshotsQueryOptionsFactory={
            client
              ? (month) =>
                  createMonthlyTuitionSnapshotsQueryOptions(client, {
                    academyId: context.academyId,
                    month,
                  })
              : undefined
          }
          yearlyLedgerQueryOptionsFactory={
            client
              ? (year) =>
                  createFinanceLedgerListQueryOptions(client, {
                    academyId: context.academyId,
                    dateRange: { from: `${year}-01-01`, to: `${year}-12-31` },
                  })
              : undefined
          }
          yearlyTuitionQueryOptionsFactory={
            client
              ? (year) =>
                  createYearlyTuitionSnapshotsQueryOptions(client, {
                    academyId: context.academyId,
                    year,
                    status: "paid",
                  })
              : undefined
          }
        />
      )}
    </FinanceDataScreen>
  );
}

const EMPTY_FINANCE_DATA: FinanceManagementData = {
  ledgerEntries: [],
  enrollments: [],
  tickets: [],
  bookSales: [],
  teachers: [],
};

/**
 * 수입 관리 화면의 월 단위 데이터를 읽는다. 조회 월이 바뀌면 그 달 범위만 다시 읽는다(서버 1000행 절단 방지).
 * `needsManagementData`가 false인 화면(전체 수입)은 자기 쿼리로 읽으므로 이 데이터를 읽지 않는다.
 */
function FinanceDataScreen({
  academyId,
  children,
  fallbackData,
  needsManagementData = true,
  useTestDemo,
}: {
  academyId: string;
  children: (
    data: FinanceManagementData,
    client: FinanceManagementSupabaseClient | null,
    refetch: () => Promise<FinanceManagementData | undefined>,
  ) => ReactNode;
  fallbackData: FinanceManagementData;
  needsManagementData?: boolean;
  useTestDemo: boolean;
}) {
  const { month } = useFinanceMonth();
  const supabaseClientState = useMemo(
    () => (useTestDemo ? null : createFinanceManagementSupabaseClient()),
    [useTestDemo],
  );
  const shouldRead = needsManagementData && (useTestDemo || !supabaseClientState?.error);
  const dataQuery = useQuery<FinanceManagementData, Error>({
    queryKey: [
      "academy",
      academyId,
      "finance",
      "management-data",
      useTestDemo ? "demo" : "remote",
      month,
    ] as const,
    queryFn: async () => {
      if (useTestDemo || !supabaseClientState?.client) {
        return fallbackData;
      }

      return fetchFinanceManagementData(supabaseClientState.client, academyId, { month });
    },
    // 월을 바꾸면 이전 월 데이터를 새 월에 섞어 보여 주지 않고 로딩 표시를 거친다(월별로 캐시되어 다시 열면 바로 보인다).
    enabled: shouldRead,
  });
  const refetch = () => readFreshData(() => dataQuery.refetch());

  if (!useTestDemo && supabaseClientState?.error) {
    return (
      <ListStatusAlert
        message="수입 관리 데이터를 불러올 수 없습니다."
        detail={toUserMessage(supabaseClientState.error)}
      />
    );
  }

  if (!needsManagementData) {
    return <>{children(useTestDemo ? fallbackData : EMPTY_FINANCE_DATA, supabaseClientState?.client ?? null, refetch)}</>;
  }

  if (dataQuery.isLoading) {
    return (
      <SectionCard padded={false}>
        <EmptyState>수입 관리 데이터를 불러오는 중입니다.</EmptyState>
      </SectionCard>
    );
  }

  if (dataQuery.isError) {
    return (
      <ListStatusAlert
        message="수입 관리 데이터를 불러오지 못했습니다."
        detail={toUserMessage(dataQuery.error)}
        onRetry={() => void dataQuery.refetch()}
      />
    );
  }

  return (
    <>{children(dataQuery.data ?? fallbackData, supabaseClientState?.client ?? null, refetch)}</>
  );
}

function createFinanceManagementSupabaseClient() {
  try {
    return {
      client:
        createSupabaseBrowserClient() as unknown as FinanceManagementSupabaseClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
