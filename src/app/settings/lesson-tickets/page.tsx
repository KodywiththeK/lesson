"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { LessonTicketSettingsScreen } from "@/features/settings/lesson-ticket-settings-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../../app-shell";

export default function LessonTicketSettingsPage() {
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
          pageTitle="설정"
        >
          <LessonTicketSettingsScreen
            academyId={academy.academyId}
            queryOptions={
              useTestDemo
                ? demo.createLessonTicketRefundPolicyQueryOptions(academy.academyId)
                : undefined
            }
            savePolicy={useTestDemo ? demo.setLessonTicketRefundPolicy : undefined}
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
