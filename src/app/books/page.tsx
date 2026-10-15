"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { BookPurchaseListScreen } from "@/features/books/book-purchase-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

export default function BooksPage() {
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
          pageTitle="교재 관리"
        >
          <BookPurchaseListScreen
            academyId={academy.academyId}
            academyName={academy.academyName}
            canRecordPayment={academy.permissionContext.role === "owner"}
            queryOptionsFactory={
              useTestDemo ? demo.createBookPurchaseListQueryOptions : undefined
            }
            students={useTestDemo ? demo.state.students : undefined}
            registerBookRelease={
              useTestDemo ? demo.registerBookRelease : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
