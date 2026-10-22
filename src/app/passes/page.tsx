"use client";

import { useEffect, useState } from "react";

import { ListStatusAlert } from "@/components/management/list-controls";
import { getFinanceToday } from "@/domain/finance-date";
import { canAccessFeature } from "@/domain/permissions";
import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { LessonTicketListScreen } from "@/features/lesson-tickets/lesson-ticket-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

// 데모 회차권 데이터가 이 날짜 기준으로 만들어져 있다. 실서비스는 오늘 날짜를 쓴다.
const DEMO_TODAY = "2026-08-21";

export default function PassesPage() {
  const demo = useDemoAcademy();
  const [today, setToday] = useState(getFinanceToday);
  const useTestDemo =
    process.env.NODE_ENV === "test" ||
    process.env.NEXT_PUBLIC_E2E_DEMO === "1";

  useEffect(() => {
    if (useTestDemo) return;

    const nextSeoulMidnight = Date.parse(`${today}T00:00:00+09:00`) + 86_400_000;
    const timer = window.setTimeout(() => setToday(getFinanceToday()), Math.max(0, nextSeoulMidnight - Date.now()));
    return () => window.clearTimeout(timer);
  }, [today, useTestDemo]);

  return (
    <AcademySessionGate>
      {(academy) => (
        <AppShell
          academyName={academy.academyName}
          permissionContext={academy.permissionContext}
          pageTitle="회차권 관리"
        >
          {academy.permissionContext.role === "teacher" ? (
            <ListStatusAlert
              message="회차권 관리 권한이 없습니다."
              detail="담당 원생의 잔여 회수는 개인레슨표에서 확인해 주세요."
            />
          ) : <LessonTicketListScreen
            academyId={academy.academyId}
            today={useTestDemo ? DEMO_TODAY : today}
            canRecordPayment={canAccessFeature(academy.permissionContext, "ticket-payment-input")}
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
            getLessonTicketRefundPreview={
              useTestDemo ? demo.getLessonTicketRefundPreview : undefined
            }
            deleteLessonTicket={
              useTestDemo ? demo.deleteLessonTicket : undefined
            }
          />}
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
