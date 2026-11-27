"use client";

import { useState } from "react";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import {
  createDemoNotificationInboxAccess,
  createSupabaseNotificationInboxAccess,
} from "@/features/notifications/notification-inbox-access";
import { NotificationInboxScreen } from "@/features/notifications/notification-inbox-screen";

import { AppShell } from "../../app-shell";

const useTestDemo = process.env.NODE_ENV === "test" || process.env.NEXT_PUBLIC_E2E_DEMO === "1";

export default function MyInboxPage() {
  const [demoAccess] = useState(() => (useTestDemo ? createDemoNotificationInboxAccess() : undefined));

  return (
    <AcademySessionGate>
      {(academy) =>
        academy.permissionContext.role === "anonymous" ? null : (
          <AppShell academyName={academy.academyName} permissionContext={academy.permissionContext} pageTitle="알림함">
            <NotificationInboxScreen
              academyId={academy.academyId}
              dataAccess={demoAccess ?? createSupabaseNotificationInboxAccess(academy.academyId)}
            />
          </AppShell>
        )
      }
    </AcademySessionGate>
  );
}
