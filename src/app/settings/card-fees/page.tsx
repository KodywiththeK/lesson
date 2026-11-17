"use client";

import { ListStatusAlert } from "@/components/management/list-controls";
import { canAccessFeature } from "@/domain/permissions";
import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { CardFeeSettingsScreen } from "@/features/settings/card-fee-settings-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../../app-shell";

export default function CardFeeSettingsPage() {
  const demo = useDemoAcademy();
  const useTestDemo =
    process.env.NODE_ENV === "test" ||
    process.env.NEXT_PUBLIC_E2E_DEMO === "1";

  return (
    <AcademySessionGate>
      {(academy) => (
        <AppShell academyName={academy.academyName} permissionContext={academy.permissionContext} pageTitle="설정">
          {canAccessFeature(academy.permissionContext, "settings") ? (
            <CardFeeSettingsScreen
              academyId={academy.academyId}
              queryOptions={useTestDemo ? demo.createCardFeeRatesQueryOptions(academy.academyId) : undefined}
              saveRate={useTestDemo ? demo.saveCardFeeRate : undefined}
              archiveRate={useTestDemo ? demo.archiveCardFeeRate : undefined}
            />
          ) : (
            <ListStatusAlert message="카드 수수료 설정을 볼 권한이 없습니다." detail="원장에게 문의해 주세요." />
          )}
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
