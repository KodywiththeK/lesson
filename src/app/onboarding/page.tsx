"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AcademySessionGate, useAcademySessionControls } from "@/features/auth/academy-session-gate";
import { OnboardingScreen } from "@/features/auth/onboarding-screen";

export default function OnboardingPage() {
  return <AcademySessionGate>{() => <ActiveOnboarding />}</AcademySessionGate>;
}

function ActiveOnboarding() {
  const session = useAcademySessionControls();
  const router = useRouter();
  return <main className="grid min-h-screen place-items-center bg-background px-5"><div className="grid w-full max-w-md gap-3">
    <OnboardingScreen onComplete={(academyId) => {
      if (!academyId) return;
      session?.selectAcademy(academyId);
      router.push("/");
    }} onSignOut={async () => { await session?.signOut(); }} />
    <Link className="text-center text-sm text-primary underline" href="/">현재 학원으로 돌아가기</Link>
  </div></main>;
}
