"use client";

import { Clipboard, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  formatPrivateLessonScheduleCopyText,
  type PrivateLessonStudentSearchResult,
} from "@/domain/private-lesson";
import { formatRecentPrivateLesson } from "@/features/lessons/workspace-helpers";

export function PrivateLessonStudentSearchDialog({
  open,
  results,
  onOpenChange,
}: {
  open: boolean;
  results: PrivateLessonStudentSearchResult[];
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const filteredResults = results.filter((result) =>
    search.trim()
      ? result.studentName
          .toLocaleLowerCase("ko-KR")
          .includes(search.trim().toLocaleLowerCase("ko-KR"))
      : true,
  );
  const selectedResult = results.find(
    (result) => result.studentId === selectedStudentId,
  );
  const canCopy = Boolean(selectedResult && selectedResult.schedule.length > 0);

  const copySchedule = async () => {
    if (!selectedResult) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        formatPrivateLessonScheduleCopyText(selectedResult.schedule),
      );
      toast.success("레슨 일정을 복사했습니다.");
    } catch {
      toast.error("레슨 일정을 복사하지 못했습니다.", {
        description: "목록의 일정을 직접 선택해 복사해 주세요.",
      });
    }
  };
  const reset = () => {
    setSearch("");
    setSelectedStudentId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>레슨원생 검색 및 선택</DialogTitle>
          <DialogDescription>
            원생을 선택하면 잔여 회차와 레슨 일정을 확인하고 복사할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            aria-label="레슨원생 검색어"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="원생 이름 검색..."
          />
          <div className="grid max-h-48 gap-2 overflow-y-auto pr-1">
            {filteredResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">검색된 원생이 없습니다.</p>
            ) : null}
            {filteredResults.map((result) => (
              <button
                key={result.studentId}
                type="button"
                aria-pressed={result.studentId === selectedStudentId}
                className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-left hover:bg-accent/40 aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-ring/25 sm:flex-row sm:items-center sm:justify-between"
                onClick={() => setSelectedStudentId(result.studentId)}
              >
                <span className="text-sm font-semibold">{result.studentName}</span>
                <span className="flex flex-wrap gap-1">
                  {result.remainingTickets.length === 0 ? (
                    <Badge variant="secondary">회차권 없음</Badge>
                  ) : null}
                  {result.remainingTickets.map((ticket) => (
                    <Badge key={ticket.instrumentId} variant="outline">
                      {ticket.instrumentName} {ticket.remainingCount}회
                    </Badge>
                  ))}
                </span>
              </button>
            ))}
          </div>
          <SelectedStudentStatus result={selectedResult} />
        </div>
        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="success"
              disabled={!canCopy}
              onClick={copySchedule}
            >
              <Clipboard aria-hidden="true" />
              복사
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>
              <RotateCcw aria-hidden="true" />
              초기화
            </Button>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="icon" aria-label="닫기">
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectedStudentStatus({
  result,
}: {
  result: PrivateLessonStudentSearchResult | undefined;
}) {
  return (
    <section
      aria-label="선택 원생 레슨 현황"
      className="grid gap-2 rounded-md border border-border bg-muted/40 p-3"
    >
      <h3 className="text-sm font-semibold">선택 원생 레슨 현황</h3>
      {result ? <SelectedStudentDetail result={result} /> : (
        <p className="text-sm text-muted-foreground">선택된 원생이 없습니다.</p>
      )}
    </section>
  );
}

function SelectedStudentDetail({
  result,
}: {
  result: PrivateLessonStudentSearchResult;
}) {
  const remainingSummary =
    result.remainingTickets.length === 0
      ? "회차권 없음"
      : result.remainingTickets
          .map((ticket) => `${ticket.instrumentName} ${ticket.remainingCount}회`)
          .join(", ");

  return (
    <>
      <p className="text-sm font-medium">{result.studentName}</p>
      <p className="text-sm text-muted-foreground">잔여 회차: {remainingSummary}</p>
      <p className="text-sm text-muted-foreground">
        {formatRecentPrivateLesson(result.recentLesson)}
      </p>
      {result.schedule.length === 0 ? (
        <p className="text-sm text-muted-foreground">이 달에 등록된 레슨이 없습니다.</p>
      ) : (
        <ul className="grid max-h-40 gap-1 overflow-y-auto text-sm">
          {result.schedule.map((item) => (
            <li key={item.lessonId}>
              {formatPrivateLessonScheduleCopyText([item])}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
