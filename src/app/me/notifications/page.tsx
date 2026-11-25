"use client";

import { useState } from "react";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import {
  browserNotificationDevice,
  createDemoNotificationSettingsAccess,
  createSupabaseNotificationSettingsAccess,
} from "@/features/notifications/notification-settings-access";
import { NotificationSettingsScreen } from "@/features/notifications/notification-settings-screen";

import { AppShell } from "../../app-shell";

const useTestDemo = process.env.NODE_ENV === "test" || process.env.NEXT_PUBLIC_E2E_DEMO === "1";

export default function MyNotificationsPage() {
  const [demoAccess] = useState(() => (useTestDemo ? createDemoNotificationSettingsAccess() : undefined));

  return (
    <AcademySessionGate>
      {(academy) =>
        academy.permissionContext.role === "anonymous" ? null : (
          <AppShell
            academyName={academy.academyName}
            permissionContext={academy.permissionContext}
            pageTitle="내 알림 설정"
          >
            <NotificationSettingsScreen
              academyId={academy.academyId}
              role={academy.permissionContext.role}
              dataAccess={demoAccess ?? createSupabaseNotificationSettingsAccess(academy.academyId)}
              device={browserNotificationDevice}
            />
          </AppShell>
        )
      }
    </AcademySessionGate>
  );
}
