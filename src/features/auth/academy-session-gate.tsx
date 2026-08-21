"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          message="Supabase 연결 설정이 필요합니다."
          detail={supabaseClientState.error.message}
        />
      </SessionShell>
    );
  }

  if (currentAcademyQuery.isLoading) {
    return (
      <SessionShell>
        <p className="text-sm text-muted-foreground">
          현재 학원 정보를 불러오는 중입니다.
        </p>
      </SessionShell>
    );
  }

  if (currentAcademyQuery.data) {
    return <>{children(currentAcademyQuery.data)}</>;
  }

  if (
    currentAcademyQuery.error instanceof AuthRequiredError ||
    currentAcademyQuery.isError
  ) {
    return <SignInPanel supabaseClientState={supabaseClientState} />;
  }

  return null;
}

function SignInPanel({
  supabaseClientState,
}: {
  supabaseClientState: Extract<SupabaseClientState, { error: null }>;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("owner@lesson.local");
  const [password, setPassword] = useState("lesson1234");
  const [isSigningIn, setIsSigningIn] = useState(false);

  return (
    <SessionShell>
      <form
        className="grid gap-4 rounded-lg border border-border bg-card p-5"
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
              description: error.message,
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
            Service Console
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
