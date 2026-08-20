import { VendorListScreen } from "@/features/vendors/vendor-list-screen";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function VendorsPage() {
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
      />
    </AppShell>
  );
}
