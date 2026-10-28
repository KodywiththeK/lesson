"use client";

import { useState } from "react";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LessonTicketListRow } from "@/domain/lesson-ticket";

export function LessonTicketServiceRevokeDialog({ ticket, isSaving, onRevoke }: {
  ticket: LessonTicketListRow;
  isSaving: boolean;
  onRevoke: (count: number, reason: string, onSaved: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [countText, setCountText] = useState("1");
  const [reason, setReason] = useState("");
  const count = Number(countText);
  const valid = Number.isInteger(count) && count > 0 &&
    count <= (ticket.serviceRemainingCount ?? 0) && reason.trim().length > 0;
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild><Button type="button" variant="outline" size="sm">
      서비스 회수
    </Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>미사용 서비스 회차 회수</AlertDialogTitle>
        <AlertDialogDescription>
          {ticket.studentName} · {ticket.instrumentName}의 미사용 서비스 {ticket.serviceRemainingCount}회 중 회수할 횟수를 입력합니다.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <label className="grid gap-1 text-sm">회수 횟수
        <Input aria-label="서비스 회수 횟수" type="number" min={1}
          max={ticket.serviceRemainingCount} value={countText}
          onChange={(event) => setCountText(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">회수 사유
        <Input aria-label="서비스 회수 사유" value={reason}
          onChange={(event) => setReason(event.target.value)} />
      </label>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isSaving}>취소</AlertDialogCancel>
        <AlertDialogAction disabled={!valid || isSaving}
          onClick={(event) => {
            event.preventDefault();
            if (valid) onRevoke(count, reason.trim(), () => setOpen(false));
          }}>회수</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
