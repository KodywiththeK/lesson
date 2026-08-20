import { LessonTicketListScreen } from "@/features/lesson-tickets/lesson-ticket-list-screen";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function PassesPage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      academyName={currentAcademy.name}
      permissionContext={{
        role: "owner",
      }}
      pageTitle="회차권 관리"
    >
      <LessonTicketListScreen
        academyId={currentAcademy.id}
        academyName={currentAcademy.name}
        today={today}
      />
    </AppShell>
  );
}
