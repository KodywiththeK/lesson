import { LessonManagementWorkspaceWithProviders } from "@/features/lessons/lesson-management-workspace";
import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function LessonsPage() {
  return (
    <AppShell
      academyName={currentAcademy.name}
      permissionContext={{
        role: "owner",
      }}
      pageTitle="레슨 시간표"
    >
      <LessonManagementWorkspaceWithProviders
        academyId={currentAcademy.id}
        academyName={currentAcademy.name}
        initialDate="2026-08-21"
        demoData={demoLessonWorkspaceData}
      />
    </AppShell>
  );
}
