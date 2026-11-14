"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const client = createSupabaseBrowserClient();
      const { error: signInError } = await client.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: new URL("/auth/callback", window.location.origin).toString() },
      });
      if (signInError) throw signInError;
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div>
        <h1 className="text-2xl font-semibold">플랫폼 관리자 로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">관리자 카카오 계정으로 로그인해 주세요.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" disabled={busy} className="bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00]" onClick={() => void signIn()}>
        {busy ? "카카오로 이동 중" : "카카오로 로그인"}
      </Button>
    </section>
  );
}
