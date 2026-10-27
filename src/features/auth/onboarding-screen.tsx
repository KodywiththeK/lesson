"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeKoreanMobile, resolveJoinDisplayStatus } from "@/domain/auth-onboarding";
import { createAcademy, listMyJoinRequests, submitJoinRequest, withdrawJoinRequest } from "@/lib/api/academy-onboarding";
import { toUserMessage } from "@/lib/errors/user-message";

type Mode = "create" | "join" | null;

export function OnboardingScreen({ onComplete, onSignOut }: {
  onComplete: (academyId?: string) => void;
  onSignOut: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [academyName, setAcademyName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdAcademy, setCreatedAcademy] = useState<{ id: string; code: string } | null>(null);
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ["my-academy-join-requests"], queryFn: listMyJoinRequests, retry: false });
  const inviteToken = typeof window === "undefined" ? null : window.sessionStorage.getItem("academy-invite-token");

  async function refreshStatus() {
    await queryClient.invalidateQueries({ queryKey: ["my-academy-join-requests"] });
    onComplete();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizeKoreanMobile(phone);
    if (!name.trim() || !normalizedPhone) {
      toast.error("이름과 국내 휴대폰 번호를 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        const [created] = await createAcademy({ academyName, name: name.trim(), phone: normalizedPhone });
        toast.success("학원을 만들었습니다.");
        setCreatedAcademy({ id: created.academy_id, code: created.join_code });
      } else {
        const secret = inviteToken ?? code.trim();
        await submitJoinRequest({ source: inviteToken ? "invite" : "code", secret, name: name.trim(), phone: normalizedPhone });
        window.sessionStorage.removeItem("academy-invite-token");
        setMode(null);
        await queryClient.invalidateQueries({ queryKey: ["my-academy-join-requests"] });
        toast.success("가입 신청을 보냈습니다. 원장 승인을 기다려 주세요.");
        onComplete();
      }
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl font-semibold">학원 시작하기</h1>
        <p className="mt-2 text-sm text-muted-foreground">학원을 만들거나 원장이 제공한 초대·코드로 가입을 신청하세요.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void onSignOut()}>로그아웃</Button>
      </div>
      {createdAcademy ? <div className="grid gap-3 rounded-lg border border-border bg-muted p-4">
        <p className="font-medium">학원을 만들었습니다. 직원에게 전달할 첫 학원 코드입니다.</p>
        <p className="break-all font-mono text-sm">{createdAcademy.code}</p>
        <p className="text-sm text-muted-foreground">코드는 다시 표시되지 않습니다. 직원 관리에서 새 코드를 발급할 수 있습니다.</p>
        <Button type="button" onClick={() => {
          window.sessionStorage.removeItem("academy-invite-token");
          onComplete(createdAcademy.id);
        }}>학원으로 이동</Button>
      </div> : null}
      {!createdAcademy && mode === null ? (
        <div className="grid gap-2">
          <Button onClick={() => setMode("create")}>새 학원 만들기</Button>
          <Button variant="outline" onClick={() => setMode("join")}>학원에 가입 신청</Button>
        </div>
      ) : !createdAcademy ? (
        <form aria-label={mode === "create" ? "학원 생성" : "학원 가입 신청"} className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <Label className="grid gap-1">이름<Input value={name} onChange={(event) => setName(event.target.value)} maxLength={50} required /></Label>
          <Label className="grid gap-1">휴대폰 번호<Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="010-1234-5678" required /></Label>
          {mode === "create" ? (
            <Label className="grid gap-1">학원명<Input value={academyName} onChange={(event) => setAcademyName(event.target.value)} maxLength={100} required /></Label>
          ) : inviteToken ? (
            <p className="text-sm text-muted-foreground">초대 링크를 확인했습니다. 신청 후 원장이 최종 승인합니다.</p>
          ) : (
            <Label className="grid gap-1">학원 코드<Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required /></Label>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "처리 중" : mode === "create" ? "학원 만들기" : "가입 신청"}</Button>
            <Button type="button" variant="outline" onClick={() => setMode(null)}>뒤로</Button>
          </div>
        </form>
      ) : null}
      <section aria-label="내 가입 신청" className="grid gap-2 border-t border-border pt-4">
        <h2 className="font-semibold">내 가입 신청</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void refreshStatus()}>승인 상태 새로고침</Button>
        {requestsQuery.isLoading ? <p className="text-sm text-muted-foreground">신청 내역을 불러오는 중입니다.</p> : null}
        {requestsQuery.isError ? <p role="alert" className="text-sm text-destructive">{toUserMessage(requestsQuery.error)}</p> : null}
        {requestsQuery.data?.length === 0 ? <p className="text-sm text-muted-foreground">가입 신청 내역이 없습니다.</p> : null}
        {requestsQuery.data?.map((request) => (
          <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            <span>{request.academy_name} · {resolveJoinDisplayStatus({ membershipStatus: request.membership_status ?? undefined, requestStatus: request.status }) ?? (request.status === "withdrawn" ? "철회" : "승인 처리")}</span>
            {request.status === "pending" ? <Button type="button" variant="outline" size="sm" onClick={async () => {
              try { await withdrawJoinRequest(request.id); await queryClient.invalidateQueries({ queryKey: ["my-academy-join-requests"] }); }
              catch (error) { toast.error(toUserMessage(error)); }
            }}>신청 철회</Button> : null}
          </div>
        ))}
      </section>
    </div>
  );
}
