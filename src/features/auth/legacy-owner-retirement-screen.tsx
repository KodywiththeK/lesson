"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getLegacyOwnerRetirementStatus, retireLegacyOwnerEmail } from "@/lib/api/legacy-owner-retirement";
import { toUserMessage } from "@/lib/errors/user-message";

type Status = Awaited<ReturnType<typeof getLegacyOwnerRetirementStatus>>;

export function LegacyOwnerRetirementScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getLegacyOwnerRetirementStatus()
      .then((result) => { if (active) setStatus(result); })
      .catch((cause) => { if (active) setError(toUserMessage(cause)); });
    return () => { active = false; };
  }, []);

  async function retire() {
    setBusy(true);
    setError(null);
    try {
      const result = await retireLegacyOwnerEmail();
      setStatus(result);
      toast.success("기존 이메일 로그인 정보를 삭제했습니다.");
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-background p-5">
    <div className="grid w-full max-w-md gap-5 rounded-2xl border border-border bg-card p-6 shadow-card">
      <BrandLogo className="w-40" />
      <div>
        <h1 className="text-2xl font-semibold">기존 이메일 로그인 정리</h1>
        <p className="mt-2 text-sm text-muted-foreground">카카오로 다시 로그인한 뒤 기존 원장 계정의 이메일 로그인 수단을 제거합니다.</p>
      </div>
      {!status && !error ? <p>계정을 확인하는 중입니다.</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status?.state === "ineligible" ? <p role="alert">기존 원장 계정에서만 사용할 수 있습니다.</p> : null}
      {status?.state === "needs-kakao" ? <p>카카오 계정을 먼저 연결해 주세요.</p> : null}
      {status?.state === "needs-review" ? <p role="alert">이메일 로그인 수단은 제거됐지만 이전 이메일 주소가 계정에 남아 있습니다. 추가 확인이 필요합니다.</p> : null}
      {status?.state === "ready" ? <>
        <p>확인한 학원: <strong>{status.academyName}</strong></p>
        <p className="text-sm text-muted-foreground">일반 카카오 로그인으로 이 학원과 기존 데이터를 열어 본 뒤 진행하세요. 먼저 비밀번호 해시를 지우고 이메일 identity를 해제합니다. 원장 계정과 학원 데이터는 유지됩니다.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={busy}>기존 이메일 로그인 정보 삭제</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>이메일 로그인을 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>카카오로 다시 로그인해 같은 학원과 데이터를 확인한 경우에만 진행하세요. 이후 기존 이메일·비밀번호로 로그인할 수 없습니다.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={() => void retire()}>삭제 확인</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </> : null}
      {status?.state === "complete" ? <p role="status">기존 이메일 로그인 정보를 삭제했습니다. 카카오 로그인으로 학원을 이용할 수 있습니다.</p> : null}
      <Link className="text-sm text-primary underline" href="/">학원으로 돌아가기</Link>
    </div>
  </main>;
}
