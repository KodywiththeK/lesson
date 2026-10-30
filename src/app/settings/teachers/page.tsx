"use client";

import { ListStatusAlert } from "@/components/management/list-controls";
import { canAccessFeature } from "@/domain/permissions";
import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { TeacherSettingsScreen } from "@/features/settings/teacher-settings-screen";
import { AppShell } from "../../app-shell";

export default function TeacherSettingsPage() {
  return <AcademySessionGate>{(academy) => <AppShell academyName={academy.academyName}
    permissionContext={academy.permissionContext} pageTitle="설정">
    {canAccessFeature(academy.permissionContext, "settings")
      ? <TeacherSettingsScreen academyId={academy.academyId} />
      : <ListStatusAlert message="선생님 설정을 볼 권한이 없습니다." detail="원장에게 문의해 주세요." />}
  </AppShell>}</AcademySessionGate>;
}
