"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { toMfaMessage } from "./mfa-error";

type TotpFactor = { id: string; friendly_name?: string };

export function AdminMfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadFactors() {
      try {
        const { data, error: listError } = await createSupabaseBrowserClient().auth.mfa.listFactors();
        if (listError) throw listError;
        if (!active) return;
        setFactors(data.totp);
        setFactorId(data.totp[0]?.id ?? "");
        if (!data.totp.length) setError("등록된 인증 앱이 없습니다. 관리자 인증 앱을 먼저 등록해 주세요.");
      } catch (cause) {
        if (active) setError(toUserMessage(cause));
      }
    }
    void loadFactors();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("인증 앱의 6자리 코드를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await createSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      onVerified();
    } catch (cause) {
      setError(toMfaMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
    <div><h1 className="text-2xl font-semibold">관리자 2단계 인증</h1><p className="mt-2 text-sm text-muted-foreground">인증 앱에 표시된 코드를 입력해 주세요.</p></div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {!factors && !error ? <p>인증 앱을 확인하는 중입니다.</p> : null}
    {factors?.length ? <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
      {factors.length > 1 ? <div className="grid gap-1"><span className="text-sm font-medium">인증 앱</span>
        <Select value={factorId} onValueChange={setFactorId}>
          <SelectTrigger aria-label="인증 앱"><SelectValue /></SelectTrigger>
          <SelectContent>{factors.map((factor, index) => <SelectItem key={factor.id} value={factor.id}>{factor.friendly_name || `인증 앱 ${index + 1}`}</SelectItem>)}</SelectContent>
        </Select>
      </div> : null}
      <Label className="grid gap-1">인증 코드<Input value={code} onChange={(event) => setCode(event.target.value.trim())} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></Label>
      <Button type="submit" disabled={busy}>{busy ? "확인 중" : "인증하기"}</Button>
    </form> : null}
  </section>;
}
