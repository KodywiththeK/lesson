import { AcademyLessonAttendanceScreen } from "@/features/academy-lessons/academy-lesson-attendance-screen";
import { PrivateLessonRegistrationScreen } from "@/features/private-lessons/private-lesson-registration-screen";

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
      <div className="grid gap-8">
        <AcademyLessonAttendanceScreen
          academyId={currentAcademy.id}
          academyName={currentAcademy.name}
        />
        <PrivateLessonRegistrationScreen
          academyId={currentAcademy.id}
          academyName={currentAcademy.name}
        />
      </div>
    </AppShell>
  );
}
