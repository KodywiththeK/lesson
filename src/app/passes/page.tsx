"use client";

import { LessonTicketListScreen } from "@/features/lesson-tickets/lesson-ticket-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function PassesPage() {
  const demo = useDemoAcademy();

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
        queryOptionsFactory={demo.createLessonTicketListQueryOptions}
        registrationOptionsQueryFactory={
          demo.createLessonTicketRegistrationOptionsQueryOptions
        }
        registerLessonTicketPurchase={demo.registerLessonTicketPurchase}
      />
    </AppShell>
  );
}
