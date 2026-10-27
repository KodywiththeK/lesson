"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { ListStatusAlert } from "@/components/management/list-controls";
import { academyRoleLabels, type ActiveAcademy } from "@/domain/auth-onboarding";
import {
  AcademySelectionRequiredError,
  AuthRequiredError,
  NoMembershipError,
  fetchCurrentAcademyContext,
  type CurrentAcademyContext,
  type CurrentAcademySupabaseClient,
} from "@/lib/api/current-academy";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { siteTagline } from "@/app/seo";

import { OnboardingScreen } from "./onboarding-screen";
import { EmailSignInForm } from "./email-sign-in-form";

const currentAcademyQueryKey = ["current-academy"] as const;
const selectedAcademyStorageKey = "selected-academy-id";

const testAcademyContext: CurrentAcademyContext = {
  academyId: "academy-demo",
  academyName: "더 클래식",
  permissionContext: { role: "owner" },
  availableAcademies: [{ academyId: "academy-demo", academyName: "더 클래식", role: "owner" }],
};

type SessionControls = {
  academies: ActiveAcademy[];
  selectAcademy: (academyId: string) => void;
  signOut: () => Promise<void>;
};

const AcademySessionContext = createContext<SessionControls | null>(null);

export function useAcademySessionControls() {
  return useContext(AcademySessionContext);
}

export function AcademySessionGate({ children }: { children: (context: CurrentAcademyContext) => ReactNode }) {
  if (process.env.NODE_ENV === "test" || process.env.NEXT_PUBLIC_E2E_DEMO === "1") {
    return <>{children(testAcademyContext)}</>;
  }
  return <AcademySessionGateInner>{children}</AcademySessionGateInner>;
}

function AcademySessionGateInner({ children }: { children: (context: CurrentAcademyContext) => ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(selectedAcademyStorageKey),
  );
  const [invitePending, setInvitePending] = useState(() =>
    typeof window !== "undefined" && Boolean(window.sessionStorage.getItem("academy-invite-token")),
  );
  const clientState = useMemo(() => {
    try { return { client: createSupabaseBrowserClient(), error: null }; }
    catch (error) { return { client: null, error: error instanceof Error ? error : new Error(String(error)) }; }
  }, []);
  const currentAcademyQuery = useQuery({
    queryKey: [...currentAcademyQueryKey, selectedId],
    queryFn: () => {
      if (!clientState.client) throw clientState.error;
      return fetchCurrentAcademyContext(clientState.client as unknown as CurrentAcademySupabaseClient, selectedId);
    },
    enabled: Boolean(clientState.client),
    retry: false,
  });

  function selectAcademy(academyId: string) {
    window.localStorage.setItem(selectedAcademyStorageKey, academyId);
    queryClient.clear();
    setSelectedId(academyId);
  }

  async function signOut() {
    if (!clientState.client) return;
    const { error } = await clientState.client.auth.signOut();
    if (error) { toast.error(toUserMessage(error)); return; }
    window.localStorage.removeItem(selectedAcademyStorageKey);
    window.sessionStorage.removeItem("academy-invite-token");
    queryClient.clear();
    setSelectedId(null);
    setInvitePending(false);
    router.replace("/");
  }

  if (clientState.error) return <SessionShell><ListStatusAlert message="서비스 연결 설정이 필요합니다." detail={toUserMessage(clientState.error)} /></SessionShell>;
  if (currentAcademyQuery.isLoading) return <SessionShell><p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">현재 학원 정보를 불러오는 중입니다.</p></SessionShell>;

  const sessionError = currentAcademyQuery.error;
  if (sessionError instanceof AuthRequiredError) return <SignInPanel />;
  if (sessionError instanceof NoMembershipError || invitePending) {
    return <SessionShell><OnboardingScreen onComplete={(academyId) => {
      if (academyId) {
        window.sessionStorage.removeItem("academy-invite-token");
        selectAcademy(academyId);
      }
      setInvitePending(false);
      void currentAcademyQuery.refetch();
    }} onSignOut={signOut} /></SessionShell>;
  }
  if (sessionError instanceof AcademySelectionRequiredError) {
    return <SessionShell><AcademySelection academies={sessionError.memberships} onSelect={selectAcademy} /></SessionShell>;
  }
  if (currentAcademyQuery.isError) return (
    <SessionShell>
      <ListStatusAlert message="학원 정보를 불러오지 못했습니다." detail={toUserMessage(sessionError)} />
      <Button type="button" variant="outline" className="mx-4" onClick={() => void currentAcademyQuery.refetch()}>다시 시도</Button>
    </SessionShell>
  );
  if (!currentAcademyQuery.data) return null;

  return (
    <AcademySessionContext.Provider value={{ academies: currentAcademyQuery.data.availableAcademies, selectAcademy, signOut }}>
      {children(currentAcademyQuery.data)}
    </AcademySessionContext.Provider>
  );
}

function SignInPanel() {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  return <SessionShell>
    <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div><p className="text-sm font-medium text-muted-foreground">학원 운영</p><h1 className="mt-1 text-2xl font-semibold">로그인</h1></div>
      <Button type="button" className="bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00] active:bg-[#E9D200] focus-visible:ring-[#FEE500]/40" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
            provider: "kakao",
            options: { redirectTo: new URL("/auth/callback", window.location.origin).toString() },
          });
          if (error) toast.error(toUserMessage(error));
        } catch (error) { toast.error(toUserMessage(error)); }
        finally { setBusy(false); }
      }}>{busy ? "카카오로 이동 중" : "카카오로 시작하기"}</Button>
      <div className="border-t border-border pt-4"><EmailSignInForm onSignedIn={() => queryClient.invalidateQueries({ queryKey: currentAcademyQueryKey })} /></div>
      {process.env.NEXT_PUBLIC_LEGACY_OWNER_LINK_ENABLED === "1" ? <a className="text-center text-sm underline" href="/auth/legacy-link">기존 원장 계정 연결</a> : null}
    </div>
  </SessionShell>;
}

function AcademySelection({ academies, onSelect }: { academies: ActiveAcademy[]; onSelect: (academyId: string) => void }) {
  return <div className="grid gap-3 rounded-2xl border border-border bg-card p-6 shadow-card">
    <h1 className="text-2xl font-semibold">사용할 학원 선택</h1>
    {academies.map((academy) => <Button key={academy.academyId} type="button" variant="outline" onClick={() => onSelect(academy.academyId)}>{academy.academyName} · {academyRoleLabels[academy.role]}</Button>)}
  </div>;
}

function SessionShell({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-background px-5"><div className="w-full max-w-md"><div className="mb-6 grid justify-items-center gap-3 text-center"><BrandLogo className="w-48 max-w-full" /><p className="text-sm text-muted-foreground">{siteTagline}</p></div>{children}</div></main>;
}
