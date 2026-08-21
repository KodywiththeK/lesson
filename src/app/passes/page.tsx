"use client";

import { LessonTicketListScreen } from "@/features/lesson-tickets/lesson-ticket-list-screen";
import {
  createDemoLessonTicketListQueryOptions,
  createDemoLessonTicketRegistrationOptionsQueryOptions,
  registerDemoLessonTicket,
} from "@/lib/demo/management-demo-data";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function PassesPage() {
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
        today="2026-08-21"
        queryOptionsFactory={createDemoLessonTicketListQueryOptions}
        registrationOptionsQueryFactory={
          createDemoLessonTicketRegistrationOptionsQueryOptions
        }
        registerLessonTicket={registerDemoLessonTicket}
      />
    </AppShell>
  );
}
