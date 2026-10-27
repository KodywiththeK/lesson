"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors/user-message";

export function LinkOwnerKakao() {
  const [state, setState] = useState<"checking" | "ready" | "linked" | "invalid">("checking");
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const client = createSupabaseBrowserClient();
        const userResult = await client.auth.getUser();
        const expectedId = window.sessionStorage.getItem("owner-link-user-id");
        if (userResult.error || !userResult.data.user || !expectedId || expectedId !== userResult.data.user.id) {
          if (active) setState("invalid");
          return;
        }
        const identities = await client.auth.getUserIdentities();
        if (identities.error) throw identities.error;
        if (active) setState(identities.data.identities.some((identity) => identity.provider === "kakao") ? "linked" : "ready");
      } catch (error) { toast.error(toUserMessage(error)); if (active) setState("invalid"); }
    }
    void check();
    return () => { active = false; };
  }, []);

  async function linkKakao() {
    try {
      const client = createSupabaseBrowserClient();
      const redirectTo = new URL("/auth/callback?next=%2Fauth%2Flink-kakao", window.location.origin).toString();
      const { error } = await client.auth.linkIdentity({ provider: "kakao", options: { redirectTo } });
      if (error) throw error;
    } catch (error) { toast.error(toUserMessage(error)); }
  }

  return <main className="grid min-h-screen place-items-center bg-background p-5"><div className="grid w-full max-w-md gap-4 rounded-2xl border border-border bg-card p-6 shadow-card"><BrandLogo className="w-40" /><h1 className="text-2xl font-semibold">카카오 계정 연결</h1>{state === "checking" ? <p>현재 계정을 확인하는 중입니다.</p> : null}{state === "invalid" ? <p role="alert">원장 계정이 일치하지 않습니다. 기존 원장 로그인부터 다시 진행해 주세요.</p> : null}{state === "ready" ? <><p>카카오 인증을 마치면 기존 학원 권한과 데이터가 같은 계정에 유지됩니다.</p><Button type="button" className="bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00] active:bg-[#E9D200] focus-visible:ring-[#FEE500]/40" onClick={() => void linkKakao()}>카카오 계정 연결</Button></> : null}{state === "linked" ? <><p role="status">같은 원장 계정에 카카오 연결을 확인했습니다.</p><p className="text-sm text-muted-foreground">로그아웃하고 일반 카카오 로그인으로 기존 학원을 확인한 뒤 계정 메뉴의 기존 이메일 로그인 정리로 이동하세요.</p><Link className="text-primary underline" href="/">학원으로 이동</Link></> : null}</div></main>;
}
