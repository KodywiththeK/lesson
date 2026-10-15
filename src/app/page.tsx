"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";

import { AppShell } from "./app-shell";

export default function Home() {
  return (
    <AcademySessionGate>
      {(academy) => (
        <AppShell
          academyName={academy.academyName}
          permissionContext={academy.permissionContext}
        />
      )}
    </AcademySessionGate>
  );
}
