"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { BookPaidScreen } from "@/features/books/book-paid-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../../app-shell";

export default function BookPaidPage() {
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
          pageTitle="교재"
        >
          <BookPaidScreen
            academyId={academy.academyId}
            canCancelPayment={academy.permissionContext.role === "owner"}
            queryOptionsFactory={
              useTestDemo ? demo.createPaidBookReleasesQueryOptions : undefined
            }
            cancelBookPayment={useTestDemo ? demo.cancelBookPayment : undefined}
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
