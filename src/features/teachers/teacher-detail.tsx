"use client";

import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Trash2, UserCheck, UserMinus } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { TeacherStatus } from "@/domain/teacher";
import { formatTeacherStatus, type TeacherListRow } from "@/domain/teacher-list";
import { toUserMessage } from "@/lib/errors/user-message";

const TEACHER_DELETE_BLOCKED_MESSAGE =
  "결제·회차권·급여 기록을 보존하기 위해 삭제할 수 없습니다. 보관 상태로 유지됩니다.";

type TeacherDetailProps = {
  teacher: TeacherListRow;
  /** 급여정보와 주민등록번호 원문 보기는 원장에게만 보여 준다. */
  isOwner: boolean;
  isStatusPending: boolean;
  onEdit: () => void;
  onChangeStatus: (status: TeacherStatus, reason?: string) => void;
  onRevealResidentRegistration: () => Promise<string>;
};

export function TeacherDetail({
  teacher,
  isOwner,
  isStatusPending,
  onEdit,
  onChangeStatus,
  onRevealResidentRegistration,
}: TeacherDetailProps) {
  const currentStatus = teacher.status ?? "employed";
  const deleteGuidanceId = useId();

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoField label="상태" value={formatTeacherStatus(currentStatus)} />
        <InfoField label="담당 파트" value={teacher.part} />
        <InfoField label="연락처" value={teacher.contact || "-"} />
        <InfoField label="등록일" value={teacher.registeredAt} />
        <InfoField
          label="계약기간"
          value={formatContractPeriod(teacher.contractStartOn, teacher.contractEndOn)}
        />
        {isOwner ? <InfoField label="급여정보" value={teacher.salarySummary ?? "-"} /> : null}
        <ResidentRegistrationField
          masked={teacher.residentRegistrationMasked}
          canReveal={isOwner}
          onReveal={onRevealResidentRegistration}
        />
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-medium">근무시간</h3>
        <div className="flex flex-wrap gap-2">
          {teacher.workSchedules && teacher.workSchedules.length > 0 ? (
            teacher.workSchedules.map((schedule) => (
              <Badge key={schedule.scheduleId ?? schedule.weekday} variant="outline">
                {schedule.startTime && schedule.endTime
                  ? `${schedule.weekdayLabel} ${schedule.startTime}-${schedule.endTime}`
                  : schedule.weekdayLabel}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            수정하기
          </Button>
          <TeacherStatusConfirmButton
            teacher={teacher}
            nextStatus="on_leave"
            disabled={isStatusPending || currentStatus === "on_leave"}
            onConfirm={onChangeStatus}
          />
          <TeacherStatusConfirmButton
            teacher={teacher}
            nextStatus="resigned"
            disabled={isStatusPending || currentStatus === "resigned"}
            onConfirm={onChangeStatus}
          />
        </div>
        <div className="grid gap-1 sm:max-w-xs sm:justify-items-end">
          <Button
            type="button"
            variant="destructive"
            disabled
            aria-describedby={deleteGuidanceId}
          >
            <Trash2 aria-hidden="true" />
            삭제
          </Button>
          <p
            id={deleteGuidanceId}
            className="text-xs text-muted-foreground sm:text-right"
          >
            {TEACHER_DELETE_BLOCKED_MESSAGE}
          </p>
        </div>
      </DialogFooter>
    </div>
  );
}

/**
 * 주민등록번호는 항상 마스킹 값으로 보여 준다. 원장은 확인을 거쳐 원문을 볼 수 있고, 원문은 이 컴포넌트의 mutation
 * 결과에만 두어 숨기거나 상세 화면을 벗어나면(언마운트) 지워진다.
 */
function ResidentRegistrationField({
  masked,
  canReveal,
  onReveal,
}: {
  masked: string | undefined;
  canReveal: boolean;
  onReveal: () => Promise<string>;
}) {
  // gcTime 0: 원문이 query 캐시에 남지 않고, 이 컴포넌트가 사라지면(상세 닫기·수정 전환) 바로 지워진다.
  const revealMutation = useMutation({ mutationFn: onReveal, gcTime: 0 });
  const revealed = revealMutation.data ?? null;
  const canOfferReveal = canReveal && Boolean(masked);

  return (
    <div className="grid gap-1 rounded-md border border-border p-3">
      <span className="text-xs font-medium text-muted-foreground">주민등록번호</span>
      <span className="text-sm font-medium tabular-nums">{revealed ?? (masked || "-")}</span>
      {revealMutation.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {toUserMessage(revealMutation.error)}
        </p>
      ) : null}
      {canOfferReveal && revealed !== null ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => revealMutation.reset()}
        >
          <EyeOff aria-hidden="true" />
          숨기기
        </Button>
      ) : null}
      {canOfferReveal && revealed === null ? (
        <RevealConfirmButton pending={revealMutation.isPending} onConfirm={() => revealMutation.mutate()} />
      ) : null}
    </div>
  );
}

function RevealConfirmButton({ pending, onConfirm }: { pending: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={pending}>
          <Eye aria-hidden="true" />
          원문 보기
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>주민등록번호 원문 보기</AlertDialogTitle>
          <AlertDialogDescription>
            원문은 원장만 볼 수 있고 열람 기록이 남습니다. 주변에 다른 사람이 없는지 확인한 뒤 열어 주세요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>원문 보기</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TeacherStatusConfirmButton({
  teacher,
  nextStatus,
  disabled,
  onConfirm,
}: {
  teacher: TeacherListRow;
  nextStatus: "on_leave" | "resigned";
  disabled: boolean;
  onConfirm: (status: TeacherStatus, reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const currentStatus = teacher.status ?? "employed";
  const nextLabel = formatTeacherStatus(nextStatus);
  const Icon = nextStatus === "on_leave" ? UserMinus : UserCheck;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <Icon aria-hidden="true" />
          {nextLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>상태 변경 확인</AlertDialogTitle>
          <AlertDialogDescription>
            {teacher.name} 선생님 상태를 {formatTeacherStatus(currentStatus)}에서{" "}
            {nextLabel}로 변경합니다. 퇴사는 30일 보관 후 자동으로
            보관 처리됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="grid gap-1 text-sm font-medium">
          <span>상태 변경 메모</span>
          <Textarea
            aria-label="상태 변경 메모"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="선택 입력"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm(nextStatus, reason.trim() || undefined);
              setReason("");
            }}
          >
            처리
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** 계약기간은 선택이라, 없거나 한쪽만 있을 때도 알아볼 수 있게 보여 준다. */
function formatContractPeriod(startOn?: string, endOn?: string) {
  if (startOn && endOn) {
    return `${startOn} - ${endOn}`;
  }

  if (startOn) {
    return `${startOn}부터`;
  }

  return endOn ? `${endOn}까지` : "계약기간 없음";
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border border-border p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
