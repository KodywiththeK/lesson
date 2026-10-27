"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeKoreanMobile } from "@/domain/auth-onboarding";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors/user-message";

export function LegacyOwnerSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizeKoreanMobile(phone);
    if (!normalizedPhone) {
      toast.error("국내 휴대폰 번호를 확인해 주세요.");
      return;
    }
    setBusy(true);
    const client = createSupabaseBrowserClient();
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userResult = await client.auth.getUser();
      if (userResult.error || !userResult.data.user) throw userResult.error ?? new Error("계정을 확인하지 못했습니다.");
      const { data, error: membershipError } = await client.from("academy_members")
        .select("id")
        .eq("user_id", userResult.data.user.id)
        .eq("role", "owner")
        .eq("status", "active")
        .limit(1);
      if (membershipError || !data?.length) {
        await client.auth.signOut();
        throw membershipError ?? new Error("기존 원장 계정만 연결할 수 있습니다.");
      }
      const { error: profileError } = await client.from("profiles")
        .update({ phone: normalizedPhone })
        .eq("id", userResult.data.user.id)
        .select("id")
        .single();
      if (profileError) throw profileError;
      window.sessionStorage.setItem("owner-link-user-id", userResult.data.user.id);
      router.replace("/auth/link-kakao");
    } catch (error) { toast.error(toUserMessage(error)); }
    finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <div className="grid w-full max-w-md gap-5 rounded-2xl border border-border bg-card p-6 shadow-card">
        <BrandLogo className="w-40" />
        <h1 className="text-2xl font-semibold">기존 원장 계정 연결</h1>
        <p className="text-sm text-muted-foreground">
          현재 원장 계정으로 먼저 로그인한 뒤 카카오를 연결합니다. 휴대폰 번호는 연락용으로 저장하며
          계정 연결에는 사용하지 않습니다. 이 화면은 전환 기간에만 열립니다.
        </p>
        <form aria-label="기존 원장 로그인" className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <Label className="grid gap-1">
            이메일
            <Input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Label>
          <Label className="grid gap-1">
            비밀번호
            <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Label>
          <Label className="grid gap-1">
            휴대폰 번호
            <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </Label>
          <Button type="submit" disabled={busy}>{busy ? "확인 중" : "원장 계정 확인"}</Button>
        </form>
      </div>
    </main>
  );
}
