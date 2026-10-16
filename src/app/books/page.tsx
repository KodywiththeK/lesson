"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { BookStockScreen } from "@/features/books/book-stock-screen";
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
          pageTitle="교재"
        >
          <BookStockScreen
            academyId={academy.academyId}
            queryOptionsFactory={
              useTestDemo ? demo.createBookStockListQueryOptions : undefined
            }
            bookOptionsQueryOptions={
              useTestDemo ? demo.createBookOptionsQueryOptions : undefined
            }
            registerBook={useTestDemo ? demo.registerBookStock : undefined}
            updateBook={useTestDemo ? demo.updateBook : undefined}
            deleteBook={useTestDemo ? demo.deleteBook : undefined}
            countPendingReleases={
              useTestDemo
                ? (book) =>
                    demo.state.bookSales.filter(
                      (sale) =>
                        sale.bookId === book.bookId &&
                        sale.status === "payment-pending",
                    ).length
                : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
