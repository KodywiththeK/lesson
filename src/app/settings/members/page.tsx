"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { OwnerMembersScreen } from "@/features/auth/owner-members-screen";
import { AppShell } from "@/app/app-shell";

export default function MembersPage() {
  return <AcademySessionGate>{(academy) => <AppShell academyName={academy.academyName} permissionContext={academy.permissionContext} pageTitle="설정">
    {academy.permissionContext.role === "owner" ? <OwnerMembersScreen academyId={academy.academyId} /> : null}
  </AppShell>}</AcademySessionGate>;
}
