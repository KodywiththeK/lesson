"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { LessonTicketListScreen } from "@/features/lesson-tickets/lesson-ticket-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

export default function PassesPage() {
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
          pageTitle="회차권 관리"
        >
          <LessonTicketListScreen
            academyId={academy.academyId}
            academyName={academy.academyName}
            today="2026-08-21"
            queryOptionsFactory={
              useTestDemo ? demo.createLessonTicketListQueryOptions : undefined
            }
            registrationOptionsQueryFactory={
              useTestDemo
                ? demo.createLessonTicketRegistrationOptionsQueryOptions
                : undefined
            }
            registerLessonTicketPurchase={
              useTestDemo ? demo.registerLessonTicketPurchase : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
