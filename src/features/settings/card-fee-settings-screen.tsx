"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { FinanceConfirmDialog } from "@/components/management/payment-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CARD_FEE_NAME_MAX_LENGTH,
  formatCardFeeRate,
  getCardFeeRateFormError,
  type CardFeeRate,
} from "@/domain/card-fee";
import {
  archiveCardFeeRate,
  createCardFeeRatesQueryOptions,
  saveCardFeeRate,
  type CardFeeRateClient,
  type CardFeeRatesQueryOptions,
} from "@/lib/api/card-fee-rates";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SaveInput = { id?: string; name: string; ratePercent: number };

type CardFeeSettingsScreenProps = {
  academyId: string;
  /** 데모·테스트가 서버 대신 쓰는 읽기·쓰기. 없으면 Supabase를 쓴다. */
  queryOptions?: CardFeeRatesQueryOptions;
  saveRate?: (input: SaveInput) => Promise<CardFeeRate>;
  archiveRate?: (id: string) => Promise<void>;
};

const EMPTY_DRAFT = { id: undefined as string | undefined, name: "", ratePercent: "" };

/**
 * 카드사별 수수료율 설정. 원장만 연다. 카드로 입금 처리하면 고른 카드사의 율로 카드 수수료를
 * 입출입내역에 출금으로 함께 기록한다. 삭제(보관)해도 이미 기록한 수수료 행은 남는다.
 */
export function CardFeeSettingsScreen({ academyId, queryOptions, saveRate, archiveRate }: CardFeeSettingsScreenProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [archiving, setArchiving] = useState<CardFeeRate | null>(null);
  const supabase = useMemo(() => (queryOptions ? null : createClientState()), [queryOptions]);
  const resolvedQueryOptions = queryOptions ?? createCardFeeRatesQueryOptions(supabase?.client as CardFeeRateClient, academyId);
  const ratesQuery = useQuery({ ...resolvedQueryOptions, enabled: Boolean(queryOptions) || Boolean(supabase?.client) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: resolvedQueryOptions.queryKey });
  const save = useMutation({
    mutationFn: (input: SaveInput) =>
      saveRate ? saveRate(input) : saveCardFeeRate(requireClient(supabase), { academyId, ...input }),
    onSuccess: async (_rate, input) => {
      setDraft(EMPTY_DRAFT);
      await invalidate();
      toast.success(input.id ? "카드사를 수정했습니다." : "카드사를 추가했습니다.");
    },
    onError: (error) => toast.error("카드사 저장에 실패했습니다.", { description: toUserMessage(error) }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => (archiveRate ? archiveRate(id) : archiveCardFeeRate(requireClient(supabase), { academyId, id })),
    onSuccess: async () => {
      setArchiving(null);
      await invalidate();
      toast.success("카드사를 삭제했습니다.");
    },
    onError: (error) => toast.error("카드사 삭제에 실패했습니다.", { description: toUserMessage(error) }),
  });
  const isEditing = draft.id !== undefined;
  const hasInput = draft.name.trim() !== "" || draft.ratePercent.trim() !== "";
  const formError = hasInput ? getCardFeeRateFormError(draft) : null;
  const error = supabase?.error ?? ratesQuery.error;

  return (
    <section aria-label="카드 수수료 설정" className="grid gap-4">
      <SectionCard className="grid gap-4">
        <SectionHeader
          title="카드 수수료"
          description="카드로 입금 처리할 때 고른 카드사의 수수료율로 카드 수수료를 입출입내역에 출금으로 함께 기록합니다. 실제 정산액과 다르면 입출입내역에서 고칠 수 있습니다."
        />
        {error ? <ListStatusAlert message="카드 수수료 설정을 불러오지 못했습니다." detail={toUserMessage(error)} /> : null}
        {ratesQuery.isLoading ? <EmptyState>카드사를 불러오는 중입니다.</EmptyState> : null}
        {ratesQuery.isSuccess && ratesQuery.data.length === 0 ? (
          <EmptyState>등록한 카드사가 없습니다. 카드로 입금해도 수입만 기록합니다.</EmptyState>
        ) : null}
        {ratesQuery.isSuccess && ratesQuery.data.length > 0 ? (
          <ul aria-label="카드사 목록" className="grid gap-2">
            {ratesQuery.data.map((rate) => (
              <li key={rate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <span className="flex items-center gap-3">
                  <span className="text-sm font-medium">{rate.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{formatCardFeeRate(rate.ratePercent)}</span>
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`${rate.name} 수정`}
                    onClick={() => setDraft({ id: rate.id, name: rate.name, ratePercent: String(rate.ratePercent) })}
                  >
                    수정
                  </Button>
                  <Button type="button" size="sm" variant="outline" aria-label={`${rate.name} 삭제`} onClick={() => setArchiving(rate)}>
                    삭제
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <form
          aria-label={isEditing ? "카드사 수정" : "카드사 추가"}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!hasInput || formError) return;
            save.mutate({
              ...(draft.id ? { id: draft.id } : {}),
              name: draft.name.trim(),
              ratePercent: Number(draft.ratePercent),
            });
          }}
        >
          <Label className="grid gap-1 text-sm font-medium">
            <span>카드사 이름</span>
            <Input
              aria-label="카드사 이름"
              value={draft.name}
              maxLength={CARD_FEE_NAME_MAX_LENGTH}
              placeholder="예: 신한카드, 지역화폐"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </Label>
          <Label className="grid gap-1 text-sm font-medium">
            <span>수수료율(%)</span>
            <Input
              aria-label="수수료율(%)"
              type="text"
              inputMode="decimal"
              value={draft.ratePercent}
              placeholder="예: 1.45"
              onChange={(event) => setDraft({ ...draft, ratePercent: event.target.value })}
            />
          </Label>
          <span className="flex gap-2">
            {isEditing ? (
              <Button type="button" variant="outline" onClick={() => setDraft(EMPTY_DRAFT)}>
                취소
              </Button>
            ) : null}
            <Button type="submit" disabled={!hasInput || formError !== null || save.isPending}>
              {isEditing ? "수정 저장" : "카드사 추가"}
            </Button>
          </span>
          {formError ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-3">
              {formError}
            </p>
          ) : null}
        </form>
      </SectionCard>
      <FinanceConfirmDialog
        open={archiving !== null}
        title={`${archiving?.name ?? "카드사"}를 삭제할까요?`}
        description="새 카드 입금에서 더 고를 수 없습니다. 이미 기록한 카드 수수료는 그대로 남습니다."
        confirmLabel="삭제"
        pending={archive.isPending}
        onConfirm={() => archiving && archive.mutate(archiving.id)}
        onOpenChange={(open) => !open && setArchiving(null)}
      />
    </section>
  );
}

function createClientState(): { client: CardFeeRateClient; error: null } | { client: null; error: Error } {
  try {
    return { client: createSupabaseBrowserClient() as unknown as CardFeeRateClient, error: null };
  } catch (error) {
    return { client: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

function requireClient(state: ReturnType<typeof createClientState> | null) {
  if (!state?.client) throw state?.error ?? new Error("Supabase client를 만들지 못했습니다.");

  return state.client;
}
