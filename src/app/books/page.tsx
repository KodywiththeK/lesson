"use client";

import { BookPurchaseListScreen } from "@/features/books/book-purchase-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function BooksPage() {
  const demo = useDemoAcademy();

  return (
    <AppShell
      academyName={currentAcademy.name}
      permissionContext={{
        role: "owner",
      }}
      pageTitle="교재 관리"
    >
      <BookPurchaseListScreen
        academyId={currentAcademy.id}
        academyName={currentAcademy.name}
        queryOptionsFactory={demo.createBookPurchaseListQueryOptions}
        students={demo.state.students}
        registerBookRelease={demo.registerBookRelease}
      />
    </AppShell>
  );
}
