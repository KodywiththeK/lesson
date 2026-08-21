"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { FinanceLedgerListScreen } from "@/features/finance/finance-ledger-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

export default function FinancePage() {
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
          <FinanceLedgerListScreen
            academyId={academy.academyId}
            academyName={academy.academyName}
            queryOptionsFactory={
              useTestDemo ? demo.createFinanceLedgerListQueryOptions : undefined
            }
            registerManualLedgerEntry={
              useTestDemo ? demo.registerManualLedgerEntry : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
