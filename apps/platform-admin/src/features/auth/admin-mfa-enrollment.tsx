"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { toMfaMessage } from "./mfa-error";

type PendingFactor = { id: string; qrCode: string };

export function AdminMfaEnrollment({ onEnrolled }: { onEnrolled: () => void }) {
  const [factor, setFactor] = useState<PendingFactor | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: enrollError } = await createSupabaseBrowserClient().auth.mfa.enroll({ factorType: "totp" });
      if (enrollError) throw enrollError;
      setFactor({ id: data.id, qrCode: data.totp.qr_code });
    } catch (cause) {
      setError(toMfaMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor || !/^\d{6}$/.test(code)) {
      setError("인증 앱의 6자리 코드를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await createSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verifyError) throw verifyError;
      setFactor(null);
      onEnrolled();
    } catch (cause) {
      setError(toMfaMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!factor) return;
    setBusy(true);
    setError(null);
    try {
      const { error: unenrollError } = await createSupabaseBrowserClient().auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) throw unenrollError;
      setFactor(null);
      setCode("");
    } catch (cause) {
      setError(toMfaMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
    <div><h1 className="text-2xl font-semibold">인증 앱 등록</h1><p className="mt-2 text-sm text-muted-foreground">관리자 로그인에 사용할 인증 앱을 등록합니다.</p></div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {!factor ? <Button type="button" disabled={busy} onClick={() => void start()}>{busy ? "준비 중" : "인증 앱 등록 시작"}</Button> : <form className="grid gap-4" onSubmit={(event) => void confirm(event)}>
      <p className="text-sm text-muted-foreground">인증 앱으로 QR 코드를 스캔한 뒤 표시되는 코드를 입력해 주세요.</p>
      {/* QR 비밀을 이미지 최적화 서버로 보내지 않도록 브라우저에서 그대로 표시한다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={factor.qrCode} alt="인증 앱 등록 QR 코드" className="size-48 max-w-full" />
      <Label className="grid gap-1">인증 코드<Input value={code} onChange={(event) => setCode(event.target.value.trim())} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></Label>
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "확인 중" : "등록 확인"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void cancel()}>등록 취소</Button></div>
    </form>}
  </section>;
}
