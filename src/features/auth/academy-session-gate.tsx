"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  AuthRequiredError,
  fetchCurrentAcademyContext,
  type CurrentAcademyContext,
  type CurrentAcademySupabaseClient,
} from "@/lib/api/current-academy";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const currentAcademyQueryKey = ["current-academy"] as const;

const testAcademyContext: CurrentAcademyContext = {
  academyId: "academy-demo",
  academyName: "더 클래식",
  permissionContext: {
    role: "owner",
  },
};

type AcademySessionGateProps = {
  children: (context: CurrentAcademyContext) => ReactNode;
};

type SupabaseClientState =
  | {
      client: CurrentAcademySupabaseClient & {
        auth: CurrentAcademySupabaseClient["auth"] & {
          signInWithPassword(input: {
            email: string;
            password: string;
          }): Promise<{ error: Error | null }>;
        };
      };
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

export function AcademySessionGate({ children }: AcademySessionGateProps) {
  if (
    process.env.NODE_ENV === "test" ||
    process.env.NEXT_PUBLIC_E2E_DEMO === "1"
  ) {
    return <>{children(testAcademyContext)}</>;
  }

  return <AcademySessionGateInner>{children}</AcademySessionGateInner>;
}

function AcademySessionGateInner({ children }: AcademySessionGateProps) {
  const supabaseClientState = useMemo(() => createSupabaseClientState(), []);
  const currentAcademyQuery = useQuery({
    queryKey: currentAcademyQueryKey,
    queryFn: () => {
      if (supabaseClientState.error) {
        throw supabaseClientState.error;
      }

      return fetchCurrentAcademyContext(supabaseClientState.client);
    },
    enabled: !supabaseClientState.error,
    retry: false,
  });

  if (supabaseClientState.error) {
    return (
      <SessionShell>
        <ListStatusAlert
          message="서비스 연결 설정이 필요합니다."
          detail={toUserMessage(supabaseClientState.error)}
        />
      </SessionShell>
    );
  }

  if (currentAcademyQuery.isLoading) {
    return (
      <SessionShell>
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
          현재 학원 정보를 불러오는 중입니다.
        </p>
      </SessionShell>
    );
  }

  if (currentAcademyQuery.data) {
    return <>{children(currentAcademyQuery.data)}</>;
  }

  if (currentAcademyQuery.error instanceof AuthRequiredError) {
    return <SignInPanel supabaseClientState={supabaseClientState} />;
  }

  if (currentAcademyQuery.isError) {
    return (
      <SessionShell>
        <ListStatusAlert
          message="학원 정보를 불러오지 못했습니다."
          detail={toUserMessage(currentAcademyQuery.error)}
        />
        <Button
          type="button"
          variant="outline"
          className="mx-4"
          onClick={() => void currentAcademyQuery.refetch()}
        >
          다시 시도
        </Button>
      </SessionShell>
    );
  }

  return null;
}

function SignInPanel({
  supabaseClientState,
}: {
  supabaseClientState: Extract<SupabaseClientState, { error: null }>;
}) {
  const queryClient = useQueryClient();
  // MVP 편의: 환경변수가 있으면 로그인 정보를 미리 채운다. 값은 소스에 두지 않고 로컬 `.env.local`에만 둔다.
  // NEXT_PUBLIC 값은 빌드 결과(브라우저 코드)에 그대로 들어가므로 배포 환경에는 설정하지 않는다.
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_PREFILL_LOGIN_EMAIL ?? "");
  const [password, setPassword] = useState(process.env.NEXT_PUBLIC_PREFILL_LOGIN_PASSWORD ?? "");
  const [isSigningIn, setIsSigningIn] = useState(false);

  return (
    <SessionShell>
      <form
        className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card"
        aria-label="로그인"
        onSubmit={async (event) => {
          event.preventDefault();
          setIsSigningIn(true);

          const { error } =
            await supabaseClientState.client.auth.signInWithPassword({
              email,
              password,
            });

          setIsSigningIn(false);

          if (error) {
            toast.error("로그인에 실패했습니다.", {
              description: toUserMessage(error),
            });
            return;
          }

          toast.success("로그인했습니다.");
          await queryClient.invalidateQueries({
            queryKey: currentAcademyQueryKey,
          });
        }}
      >
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            학원 운영
          </p>
          <h1 className="mt-1 text-2xl font-semibold">로그인</h1>
        </div>
        <Label className="grid gap-1">
          <span>이메일</span>
          <Input
            aria-label="이메일"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>비밀번호</span>
          <Input
            aria-label="비밀번호"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Label>
        <Button type="submit" disabled={isSigningIn}>
          <LogIn aria-hidden="true" />
          {isSigningIn ? "로그인 중" : "로그인"}
        </Button>
      </form>
    </SessionShell>
  );
}

function SessionShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

function createSupabaseClientState(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as Extract<SupabaseClientState, { error: null }>["client"],
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
