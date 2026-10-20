"use client";

import { useId, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { LedgerCategory, LedgerEntry } from "@/domain/book-sale";
import { getFinanceToday } from "@/domain/finance-date";
import {
  formatLedgerEntrySource,
  formatLedgerEntryType,
  getLedgerCategoryOptions,
  getLedgerDraftBlockReason,
  toDefaultLedgerCategory,
  toDefaultLedgerCategoryForType,
} from "@/domain/finance-ledger";
import { parseWonInput } from "@/domain/money-input";

export type LedgerFormValues = {
  occurredOn: string;
  type: LedgerEntry["type"];
  category: LedgerCategory;
  amount: number;
  description: string;
};

const LEDGER_TYPES: LedgerEntry["type"][] = ["income", "expense"];

export function LedgerRegisterDialog({
  contextMonth,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  /** 지금 보고 있는 월(`YYYY-MM`). 다른 월 날짜를 고르면 어느 월에 기록되는지 안내한다. */
  contextMonth: string;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LedgerFormValues) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogTrigger asChild>
        <Button type="button">
          <CircleDollarSign aria-hidden="true" />
          수동 입출금 등록
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>수동 입출금 등록</DialogTitle>
          <DialogDescription>
            자동 입금 외 조정 내역을 직접 기록합니다.
          </DialogDescription>
        </DialogHeader>
        <LedgerEntryForm
          formLabel="수동 입출금 입력"
          submitLabel="저장"
          contextMonth={contextMonth}
          pending={pending}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

export function LedgerEditDialog({
  entry,
  pending,
  onClose,
  onSubmit,
}: {
  entry: LedgerEntry | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (entry: LedgerEntry, values: LedgerFormValues) => void;
}) {
  return (
    <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>입출금 내역 수정</DialogTitle>
          <DialogDescription>
            자동 생성 내역도 수정할 수 있으며 변경 이력은 감사 로그로 남습니다.
          </DialogDescription>
        </DialogHeader>
        {entry ? (
          <LedgerEntryForm
            key={entry.ledgerId}
            formLabel="입출금 내역 수정 입력"
            initialEntry={entry}
            submitLabel="수정 저장"
            contextMonth={entry.occurredOn.slice(0, 7)}
            pending={pending}
            onSubmit={(values) => onSubmit(entry, values)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type LedgerDraft = {
  occurredOn: string;
  type: LedgerEntry["type"];
  category: LedgerCategory;
  amountText: string;
  description: string;
};

/**
 * 새 입출금은 날짜·유형·분류·설명·금액만 받는다(출처는 항상 수동).
 * 자동 기록(수강료·교재·급여·회차권) 수정 때는 유형과 출처를 잠근다.
 */
export function LedgerEntryForm({
  contextMonth,
  formLabel,
  initialEntry,
  pending,
  submitLabel,
  onSubmit,
}: {
  contextMonth: string;
  formLabel: string;
  initialEntry?: LedgerEntry;
  pending: boolean;
  submitLabel: string;
  onSubmit: (values: LedgerFormValues) => void;
}) {
  const [draft, setDraft] = useState<LedgerDraft>(() => createInitialDraft(initialEntry));
  const hintId = useId();
  const isAutoRecorded = Boolean(initialEntry && initialEntry.source !== "manual");
  const blockReason = getLedgerDraftBlockReason(draft);
  const recordedMonth = draft.occurredOn.slice(0, 7);
  const showsOtherMonth = Boolean(draft.occurredOn) && recordedMonth !== contextMonth;

  function changeType(type: LedgerEntry["type"]) {
    setDraft((current) => ({
      ...current,
      type,
      category: toDefaultLedgerCategoryForType(type),
    }));
  }

  return (
    <form
      aria-label={formLabel}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = parseWonInput(draft.amountText);

        if (blockReason || amount === null || pending) {
          return;
        }

        onSubmit({
          occurredOn: draft.occurredOn,
          type: draft.type,
          category: draft.category,
          amount,
          description: draft.description.trim(),
        });
      }}
    >
      {isAutoRecorded && initialEntry ? (
        <div className="grid gap-1 rounded-md bg-muted px-3 py-2 text-sm">
          <p className="font-medium">출처: {formatLedgerEntrySource(initialEntry.source)}</p>
          <p className="text-muted-foreground">
            자동으로 기록된 내역입니다. 여기서 고쳐도 수강료·교재·급여 원본에는 반영되지 않습니다.
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>발생일</span>
          <DateField
            aria-label="발생일"
            required
            value={draft.occurredOn}
            onValueChange={(occurredOn) => setDraft((current) => ({ ...current, occurredOn }))}
          />
        </Label>
        <Label className="grid gap-1">
          <span>유형</span>
          <NativeSelect
            aria-label="유형"
            disabled={isAutoRecorded}
            value={draft.type}
            onChange={(event) => changeType(event.target.value as LedgerEntry["type"])}
          >
            {LEDGER_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {formatLedgerEntryType(type)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </div>
      {showsOtherMonth ? (
        <p className="text-sm text-muted-foreground">
          발생일이 속한 {Number(recordedMonth.slice(5))}월 입출입내역으로 기록됩니다.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>분류</span>
          <NativeSelect
            aria-label="분류"
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({ ...current, category: event.target.value as LedgerCategory }))
            }
          >
            {getLedgerCategoryOptions(draft.type, initialEntry?.category).map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>금액</span>
          <Input
            aria-label="금액"
            type="text"
            inputMode="numeric"
            placeholder="금액(원)"
            value={draft.amountText}
            onChange={(event) => {
              const amountText = event.target.value;
              setDraft((current) => ({ ...current, amountText }));
            }}
            onBlur={() => {
              const amount = parseWonInput(draft.amountText);
              if (amount !== null) {
                setDraft((current) => ({ ...current, amountText: amount.toLocaleString("ko-KR") }));
              }
            }}
          />
        </Label>
      </div>
      <Label className="grid gap-1">
        <span>설명</span>
        <Input
          aria-label="설명"
          placeholder="예: 악기 조율비"
          value={draft.description}
          onChange={(event) => {
            const description = event.target.value;
            setDraft((current) => ({ ...current, description }));
          }}
        />
      </Label>
      {blockReason ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {blockReason}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          type="submit"
          disabled={Boolean(blockReason) || pending}
          aria-describedby={blockReason ? hintId : undefined}
        >
          {pending ? "저장 중" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function createInitialDraft(entry: LedgerEntry | undefined): LedgerDraft {
  if (!entry) {
    return {
      occurredOn: getFinanceToday(),
      type: "income",
      category: toDefaultLedgerCategoryForType("income"),
      amountText: "",
      description: "",
    };
  }

  return {
    occurredOn: entry.occurredOn,
    type: entry.type,
    category: entry.category ?? toDefaultLedgerCategory(entry.source),
    amountText: String(entry.amount),
    description: entry.description,
  };
}
