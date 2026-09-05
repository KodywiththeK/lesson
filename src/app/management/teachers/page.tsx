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
          pageTitle="선생님 관리"
        >
          <TeacherListScreen
            academyId={academy.academyId}
            academyName={academy.academyName}
            queryOptionsFactory={
              useTestDemo ? demo.createTeacherListQueryOptions : undefined
            }
            registerTeacher={useTestDemo ? demo.registerTeacher : undefined}
            updateTeacher={useTestDemo ? demo.updateTeacher : undefined}
            updateTeacherStatus={
              useTestDemo ? demo.updateTeacherStatus : undefined
            }
            deleteTeacher={useTestDemo ? demo.deleteTeacher : undefined}
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
