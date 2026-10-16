"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { TeacherListScreen } from "@/features/teachers/teacher-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../../app-shell";

export default function TeachersPage() {
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
          pageTitle="인원·거래처"
        >
          <TeacherListScreen
            academyId={academy.academyId}
            academyName={academy.academyName}
            isOwner={academy.permissionContext.role === "owner"}
            queryOptionsFactory={
              useTestDemo ? demo.createTeacherListQueryOptions : undefined
            }
            registerTeacher={useTestDemo ? demo.registerTeacher : undefined}
            updateTeacher={useTestDemo ? demo.updateTeacher : undefined}
            updateTeacherStatus={
              useTestDemo ? demo.updateTeacherStatus : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
