"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { LessonScheduleSettingsScreen } from "@/features/settings/lesson-schedule-settings-screen";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../../app-shell";

export default function LessonScheduleSettingsPage() {
  const demo = useDemoAcademy();
  const useTestDemo = process.env.NODE_ENV === "test" || process.env.NEXT_PUBLIC_E2E_DEMO === "1";
  const demoInstruments = useTestDemo ? [...new Map(demo.state.enrollments
    .filter((item) => item.lessonType === "private" && item.active)
    .map((item) => [item.instrumentId, { id: item.instrumentId, name: item.instrumentName }] as const)).values()] : undefined;

  return <AcademySessionGate>{(academy) =>
    <AppShell academyName={academy.academyName} permissionContext={academy.permissionContext} pageTitle="설정">
      <LessonScheduleSettingsScreen academyId={academy.academyId} demoInstruments={demoInstruments} />
    </AppShell>
  }</AcademySessionGate>;
}
