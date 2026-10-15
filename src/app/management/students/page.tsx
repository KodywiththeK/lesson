"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { StudentListScreen } from "@/features/students/student-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../../app-shell";

export default function StudentsPage() {
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
          <StudentListScreen
            academyId={academy.academyId}
            academyName={academy.academyName}
            queryOptionsFactory={
              useTestDemo ? demo.createStudentListQueryOptions : undefined
            }
            teachers={
              useTestDemo
                ? demo.state.teachers.filter(
                    (teacher) => (teacher.status ?? "employed") === "employed",
                  )
                : undefined
            }
            registerStudent={useTestDemo ? demo.registerStudent : undefined}
            updateStudent={useTestDemo ? demo.updateStudent : undefined}
            updateStudentStatus={
              useTestDemo ? demo.updateStudentStatus : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
