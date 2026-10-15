"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

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
import { toUserMessage } from "@/lib/errors/user-message";
import {
  fetchFinanceManagementData,
  createMonthlyTuitionSnapshotsQueryOptions,
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
        {(financeData) => (
          <FinanceBooksScreen
            academyId={context.academyId}
            financeData={financeData}
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
        {(financeData, client) => (
          <FinancePayrollScreen
            academyId={context.academyId}
            financeData={financeData}
            markPayrollPaid={
              client
                ? (input) => markPayrollSettlementAsPaid(client, input)
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
      useTestDemo={context.useTestDemo}
    >
      {(financeData) => (
        <FinanceOverviewScreen
          academyId={context.academyId}
          financeData={financeData}
        />
      )}
    </FinanceDataScreen>
  );
}

function FinanceDataScreen({
  academyId,
  children,
  fallbackData,
  useTestDemo,
}: {
  academyId: string;
  children: (
    data: FinanceManagementData,
    client: FinanceManagementSupabaseClient | null,
  ) => ReactNode;
  fallbackData: FinanceManagementData;
  useTestDemo: boolean;
}) {
  const supabaseClientState = useMemo(
    () => (useTestDemo ? null : createFinanceManagementSupabaseClient()),
    [useTestDemo],
  );
  const dataQuery = useQuery<FinanceManagementData, Error>({
    queryKey: [
      "academy",
      academyId,
      "finance",
      "management-data",
      useTestDemo ? "demo" : "remote",
    ] as const,
    queryFn: async () => {
      if (useTestDemo || !supabaseClientState?.client) {
        return fallbackData;
      }

      return fetchFinanceManagementData(supabaseClientState.client, academyId);
    },
    enabled: useTestDemo || !supabaseClientState?.error,
  });

  if (!useTestDemo && supabaseClientState?.error) {
    return (
      <ListStatusAlert
        message="수입 관리 데이터를 불러올 수 없습니다."
        detail={toUserMessage(supabaseClientState.error)}
      />
    );
  }

  if (dataQuery.isLoading) {
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        수입 관리 데이터를 불러오는 중입니다.
      </p>
    );
  }

  if (dataQuery.isError) {
    return (
      <ListStatusAlert
        message="수입 관리 데이터를 불러오지 못했습니다."
        detail={toUserMessage(dataQuery.error)}
      />
    );
  }

  return <>{children(dataQuery.data ?? fallbackData, supabaseClientState?.client ?? null)}</>;
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
