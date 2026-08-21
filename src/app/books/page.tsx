"use client";

import { BookPurchaseListScreen } from "@/features/books/book-purchase-list-screen";
import { createDemoBookPurchaseListQueryOptions } from "@/lib/demo/management-demo-data";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function BooksPage() {
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
        queryOptionsFactory={createDemoBookPurchaseListQueryOptions}
      />
    </AppShell>
  );
}
