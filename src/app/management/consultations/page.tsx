"use client";

import { ConsultationListScreen } from "@/features/consultations/consultation-list-screen";
import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../../app-shell";

export default function ConsultationsPage() {
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
          pageTitle="인원·거래처"
        >
          <ConsultationListScreen
            academyId={academy.academyId}
            queryOptionsFactory={
              useTestDemo ? demo.createConsultationListQueryOptions : undefined
            }
            teachers={
              useTestDemo
                ? demo.state.teachers.filter(
                    (teacher) => (teacher.status ?? "employed") === "employed",
                  )
                : undefined
            }
            registerConsultation={useTestDemo ? demo.registerConsultation : undefined}
            updateConsultation={useTestDemo ? demo.updateConsultation : undefined}
            deleteConsultation={useTestDemo ? demo.deleteConsultation : undefined}
            registerStudent={useTestDemo ? demo.registerStudent : undefined}
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
