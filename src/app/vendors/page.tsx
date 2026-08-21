"use client";

import { VendorListScreen } from "@/features/vendors/vendor-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function VendorsPage() {
  const demo = useDemoAcademy();

  return (
    <AppShell
      academyName={currentAcademy.name}
      permissionContext={{
        role: "owner",
      }}
      pageTitle="거래처 관리"
    >
      <VendorListScreen
        academyId={currentAcademy.id}
        academyName={currentAcademy.name}
        queryOptionsFactory={demo.createVendorListQueryOptions}
        registerVendor={demo.registerVendor}
      />
    </AppShell>
  );
}
