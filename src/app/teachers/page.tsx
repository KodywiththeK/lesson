import { TeacherListScreen } from "@/features/teachers/teacher-list-screen";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function TeachersPage() {
  return (
    <AppShell
      academyName={currentAcademy.name}
      permissionContext={{
        role: "owner",
      }}
      pageTitle="선생님 관리"
    >
      <TeacherListScreen
        academyId={currentAcademy.id}
        academyName={currentAcademy.name}
      />
    </AppShell>
  );
}
