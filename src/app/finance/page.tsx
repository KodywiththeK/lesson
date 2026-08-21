"use client";

import { FinanceLedgerListScreen } from "@/features/finance/finance-ledger-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function FinancePage() {
  const demo = useDemoAcademy();

  return (
    <AppShell
      academyName={currentAcademy.name}
      permissionContext={{
        role: "owner",
      }}
      pageTitle="수입 관리"
    >
      <FinanceLedgerListScreen
        academyId={currentAcademy.id}
        academyName={currentAcademy.name}
        queryOptionsFactory={demo.createFinanceLedgerListQueryOptions}
        registerManualLedgerEntry={demo.registerManualLedgerEntry}
      />
    </AppShell>
  );
}
