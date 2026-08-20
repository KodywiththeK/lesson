import { FinanceLedgerListScreen } from "@/features/finance/finance-ledger-list-screen";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function FinancePage() {
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
      />
    </AppShell>
  );
}
