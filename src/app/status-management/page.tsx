"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { StatusManagementScreen } from "@/features/status-management/status-management-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

export default function StatusManagementPage() {
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
          pageTitle="휴원/퇴원 관리"
        >
          <StatusManagementScreen
            academyId={academy.academyId}
            academyName={academy.academyName}
            studentQueryOptionsFactory={
              useTestDemo
                ? demo.createStudentStatusManagementQueryOptions
                : undefined
            }
            teacherQueryOptionsFactory={
              useTestDemo
                ? demo.createTeacherStatusManagementQueryOptions
                : undefined
            }
            updateStudentStatus={
              useTestDemo ? demo.updateStudentStatus : undefined
            }
            updateTeacherStatus={
              useTestDemo ? demo.updateTeacherStatus : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
