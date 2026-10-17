"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { StudentListScreen } from "@/features/students/student-list-screen";
import { TeacherStudentRosterScreen } from "@/features/students/teacher-student-roster-screen";
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
          {academy.permissionContext.role === "teacher" ? (
            // 선생님은 담당 원생의 이름·악기·요일만 읽기 전용으로 본다. 민감 정보는 서버 RPC가 내려주지 않는다.
            <TeacherStudentRosterScreen academyId={academy.academyId} />
          ) : (
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
              updateStudent={useTestDemo ? demo.updateStudentEnrollments : undefined}
              updateStudentStatus={
                useTestDemo ? demo.updateStudentStatus : undefined
              }
            />
          )}
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
