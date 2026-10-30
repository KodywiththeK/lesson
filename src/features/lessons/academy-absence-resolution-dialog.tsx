"use client";

import { useState } from "react";

import { DateField, TimeField } from "@/components/operations/date-time-fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { checkAbsenceResolutionInput } from "@/domain/academy-lesson-absence";
import {
  formatMakeupDateLabel,
  type MakeupDateRecommendation,
} from "@/domain/academy-makeup-recommendation";
import type { AbsenceResolutionKind } from "@/domain/academy-lesson-attendance";
import { AcademyMakeupRecommendation } from "@/features/lessons/academy-makeup-recommendation";
import type { AbsenceResolutionDraft } from "@/features/lessons/workspace-types";

/**
 * 결석 사유서. 입력 순서는 ① 사유 선택(필수) ② 보강 날짜·시간 ③ 사유 메모(선택)로 고정한다.
 * 사유를 고르기 전과 패스일 때는 날짜·시간이 잠기고, 확인하면 한 번 더 "최종확인"을 받는다.
 */
export function AcademyAbsenceResolutionDialog({
  draft,
  recommendations,
  recommendationsLoading = false,
  recommendationError = false,
  onRetryRecommendations,
  isSaving,
  onChange,
  onClose,
  onConfirm,
}: {
  draft: AbsenceResolutionDraft | null;
  recommendations: MakeupDateRecommendation[];
  recommendationsLoading?: boolean;
  recommendationError?: boolean;
  onRetryRecommendations?: () => void;
  isSaving: boolean;
  onChange: (draft: AbsenceResolutionDraft) => void;
  onClose: () => void;
  onConfirm: (draft: AbsenceResolutionDraft) => Promise<void>;
}) {
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>결석 사유서</DialogTitle>
          <DialogDescription>
            {draft ? describeAbsence(draft) : ""}
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <>
            <ResolutionForm
              draft={draft}
              recommendations={recommendations}
              recommendationsLoading={recommendationsLoading}
              recommendationError={recommendationError}
              onRetryRecommendations={onRetryRecommendations}
              onChange={onChange}
            />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
                취소
              </Button>
              <Button
                type="button"
                disabled={isSaving || !canConfirm(draft)}
                onClick={() => setFinalConfirmOpen(true)}
              >
                확인
              </Button>
            </DialogFooter>
            <AlertDialog open={finalConfirmOpen} onOpenChange={setFinalConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>최종확인하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>{describeResolution(draft)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSaving}>취소</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isSaving}
                    onClick={(event) => {
                      // 저장이 끝나기 전에는 닫지 않아 중복 클릭과 실패 후 재시도를 막지 않는다.
                      event.preventDefault();
                      void onConfirm(draft).finally(() => setFinalConfirmOpen(false));
                    }}
                  >
                    확인
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ResolutionForm({
  draft,
  recommendations,
  recommendationsLoading,
  recommendationError,
  onRetryRecommendations,
  onChange,
}: {
  draft: AbsenceResolutionDraft;
  recommendations: MakeupDateRecommendation[];
  recommendationsLoading: boolean;
  recommendationError: boolean;
  onRetryRecommendations?: () => void;
  onChange: (draft: AbsenceResolutionDraft) => void;
}) {
  const isMakeup = draft.resolution === "makeup";
  const chooseResolution = (resolution: AbsenceResolutionKind) =>
    onChange(
      resolution === "makeup"
        ? {
            ...draft,
            resolution,
            targetDate: draft.targetDate || recommendations[0]?.date || "",
          }
        : { ...draft, resolution, targetDate: "", startTime: "" },
    );

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">① 사유 선택</legend>
        <RadioGroup
          aria-label="사유 선택"
          value={draft.resolution}
          onValueChange={(value) => chooseResolution(value as AbsenceResolutionKind)}
          className="grid-cols-2"
        >
          <ResolutionOption value="makeup" label="보강" />
          <ResolutionOption value="pass" label="패스" />
        </RadioGroup>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">② 보강 날짜·시간</legend>
        {isMakeup && recommendationsLoading ? <p>보강 추천을 준비하고 있습니다.</p> : null}
        {isMakeup && recommendationError ? <div role="alert" className="grid gap-2 text-sm">
          <p>공휴일 자료를 확인하지 못해 보강일 추천을 보류했습니다. 보강일은 직접 선택할 수 있습니다.</p>
          {onRetryRecommendations ? <Button type="button" variant="outline" onClick={onRetryRecommendations}>보강 추천 다시 시도</Button> : null}
        </div> : null}
        {isMakeup && !recommendationsLoading && !recommendationError ? (
          <AcademyMakeupRecommendation
            recommendations={recommendations}
            selectedDate={draft.targetDate}
            onSelectDate={(targetDate) => onChange({ ...draft, targetDate })}
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="grid gap-1 text-sm font-medium">
            <span>보강일</span>
            <DateField
              aria-label="보강일"
              value={draft.targetDate}
              disabled={!isMakeup}
              onValueChange={(targetDate) => onChange({ ...draft, targetDate })}
            />
          </Label>
          <Label className="grid gap-1 text-sm font-medium">
            <span>보강 시간 (선택)</span>
            <TimeField
              aria-label="보강 시간"
              value={draft.startTime}
              disabled={!isMakeup}
              onValueChange={(startTime) => onChange({ ...draft, startTime })}
            />
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {isMakeup
            ? "보강 시간은 입력하지 않아도 됩니다. 입력하지 않으면 시간은 표시하지 않습니다."
            : "사유를 보강으로 선택하면 날짜와 시간을 입력할 수 있습니다. 패스는 날짜가 필요 없습니다."}
        </p>
        <TimeProblem draft={draft} />
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">③ 사유 메모 (선택)</legend>
        <Textarea
          aria-label="사유 메모"
          value={draft.reason}
          placeholder="예: 감기로 결석"
          onChange={(event) => onChange({ ...draft, reason: event.target.value })}
        />
      </fieldset>
    </div>
  );
}

function ResolutionOption({ value, label }: { value: AbsenceResolutionKind; label: string }) {
  const id = `absence-resolution-${value}`;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
      <RadioGroupItem id={id} value={value} />
      <Label htmlFor={id} className="flex-1 cursor-pointer text-sm font-medium">
        {label}
      </Label>
    </div>
  );
}

function TimeProblem({ draft }: { draft: AbsenceResolutionDraft }) {
  const check = checkAbsenceResolutionInput(draft, draft.row);

  if (check.ok || draft.resolution !== "makeup" || !draft.targetDate) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-destructive">
      {check.reason}
    </p>
  );
}

function canConfirm(draft: AbsenceResolutionDraft) {
  return checkAbsenceResolutionInput(draft, draft.row).ok;
}

function describeAbsence(draft: AbsenceResolutionDraft) {
  const { row } = draft;
  const time = row.timeUnspecified ? "" : ` ${row.startTime}`;

  return `${row.studentName} · ${formatMakeupDateLabel(row.date)}${time} ${row.instrumentName} 결석`;
}

function describeResolution(draft: AbsenceResolutionDraft) {
  const name = draft.row.studentName;

  if (draft.resolution === "pass") {
    return `${name} 원생의 결석을 패스로 처리합니다. 확인하면 결석인원 목록에 패스 완료로 표시되고 월별 메모에 기록됩니다.`;
  }

  const time = draft.startTime ? ` ${draft.startTime}` : "";

  return `${name} 원생의 결석을 보강 ${formatMakeupDateLabel(draft.targetDate)}${time} 일정으로 처리합니다. 보강일에 [보강 수업] 일정이 만들어지고 월별 메모에 기록됩니다.`;
}
