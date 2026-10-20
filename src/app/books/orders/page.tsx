"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { BookOrderScreen } from "@/features/books/book-order-screen";

import { AppShell } from "../../app-shell";

export default function BookOrdersPage() {
  return (
    <AcademySessionGate>
      {(academy) => (
        <AppShell
          academyName={academy.academyName}
          permissionContext={academy.permissionContext}
          pageTitle="교재"
        >
          <BookOrderScreen
            academyId={academy.academyId}
            canPay={academy.permissionContext.role === "owner"}
            demoReadOnly={process.env.NODE_ENV === "test" || process.env.NEXT_PUBLIC_E2E_DEMO === "1"}
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
