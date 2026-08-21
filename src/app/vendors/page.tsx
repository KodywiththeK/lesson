"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { VendorListScreen } from "@/features/vendors/vendor-list-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

export default function VendorsPage() {
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
          pageTitle="거래처 관리"
        >
          <VendorListScreen
            academyId={academy.academyId}
            academyName={academy.academyName}
            queryOptionsFactory={
              useTestDemo ? demo.createVendorListQueryOptions : undefined
            }
            registerVendor={useTestDemo ? demo.registerVendor : undefined}
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
