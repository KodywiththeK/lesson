"use client";

import { StudentListScreen } from "@/features/students/student-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function StudentsPage() {
  const demo = useDemoAcademy();

  return (
    <AppShell
      academyName={currentAcademy.name}
      permissionContext={{
        role: "owner",
      }}
      pageTitle="원생 관리"
    >
      <StudentListScreen
        academyId={currentAcademy.id}
        academyName={currentAcademy.name}
        queryOptionsFactory={demo.createStudentListQueryOptions}
        teachers={demo.state.teachers}
        registerStudent={demo.registerStudent}
      />
    </AppShell>
  );
}
