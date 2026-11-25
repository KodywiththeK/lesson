"use client";

import { useState } from "react";

import { getFinanceToday } from "@/domain/finance-date";
import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { DashboardShortcuts } from "@/features/dashboard/dashboard-shortcuts";
import { TodayTasks } from "@/features/dashboard/today-tasks";
import { createDemoDailyTasksAccess } from "@/lib/demo/daily-tasks-demo";

import { AppShell } from "./app-shell";

const useTestDemo = process.env.NODE_ENV === "test" || process.env.NEXT_PUBLIC_E2E_DEMO === "1";

export default function Home() {
  const [demoDailyTasks] = useState(() => (useTestDemo ? createDemoDailyTasksAccess(getFinanceToday()) : undefined));

  return (
    <AcademySessionGate>
      {(academy) => (
        <AppShell
          academyName={academy.academyName}
          permissionContext={academy.permissionContext}
        >
          <TodayTasks
            academyId={academy.academyId}
            permissionContext={academy.permissionContext}
            dataAccess={demoDailyTasks}
          />
          <DashboardShortcuts permissionContext={academy.permissionContext} />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
