"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function EmailSignInForm({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [email, setEmail] = useState(() =>
    process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_PREFILL_LOGIN_EMAIL ?? "" : "",
  );
  const [password, setPassword] = useState(() =>
    process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_PREFILL_LOGIN_PASSWORD ?? "" : "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      await onSignedIn();
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form aria-label="이메일 로그인" className="grid gap-3" onSubmit={(event) => void submit(event)}>
      <Label className="grid gap-1">
        이메일
        <Input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </Label>
      <Label className="grid gap-1">
        비밀번호
        <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </Label>
      <Button type="submit" variant="outline" disabled={busy}>{busy ? "로그인 중" : "이메일로 로그인"}</Button>
    </form>
  );
}
