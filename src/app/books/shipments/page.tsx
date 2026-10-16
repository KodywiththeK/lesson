"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { BookShipmentScreen } from "@/features/books/book-shipment-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../../app-shell";

export default function BookShipmentsPage() {
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
          <BookShipmentScreen
            academyId={academy.academyId}
            canRecordPayment={academy.permissionContext.role === "owner"}
            queryOptionsFactory={
              useTestDemo ? demo.createPendingBookReleasesQueryOptions : undefined
            }
            bookOptionsQueryOptionsFactory={
              useTestDemo ? demo.createBookOptionsQueryOptions : undefined
            }
            students={
              useTestDemo
                ? demo.state.students.filter(
                    (student) => (student.status ?? "enrolled") === "enrolled",
                  )
                : undefined
            }
            registerBookRelease={useTestDemo ? demo.registerBookRelease : undefined}
            updateBookRelease={useTestDemo ? demo.updateBookRelease : undefined}
            deleteBookRelease={useTestDemo ? demo.deleteBookRelease : undefined}
            completeBookPayment={useTestDemo ? demo.completeBookPayment : undefined}
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
