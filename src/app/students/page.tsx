"use client";

import { StudentListScreen } from "@/features/students/student-list-screen";
import { createDemoStudentListQueryOptions } from "@/lib/demo/management-demo-data";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function StudentsPage() {
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
        queryOptionsFactory={createDemoStudentListQueryOptions}
      />
    </AppShell>
  );
}
