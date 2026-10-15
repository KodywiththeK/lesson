"use client";

import { getFinanceToday } from "@/domain/finance-date";
import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { LessonTicketListScreen } from "@/features/lesson-tickets/lesson-ticket-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

// 데모 회차권 데이터가 이 날짜 기준으로 만들어져 있다. 실서비스는 오늘 날짜를 쓴다.
const DEMO_TODAY = "2026-08-21";

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
            today={useTestDemo ? DEMO_TODAY : getFinanceToday()}
            queryOptionsFactory={
              useTestDemo ? demo.createLessonTicketListQueryOptions : undefined
            }
            registrationOptionsQueryFactory={
              useTestDemo
                ? demo.createLessonTicketRegistrationOptionsQueryOptions
                : undefined
            }
            registerLessonTicket={
              useTestDemo ? demo.registerLessonTicket : undefined
            }
            adjustLessonTicket={
              useTestDemo ? demo.adjustLessonTicket : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
