import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LedgerEntry } from "@/domain/book-sale";
import { toDefaultLedgerCategory } from "@/domain/finance-ledger";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  deleteFinanceLedgerEntry as deleteFinanceLedgerEntryApi,
  registerManualLedgerEntry as registerManualLedgerEntryApi,
  updateFinanceLedgerEntry as updateFinanceLedgerEntryApi,
  type RegisterManualLedgerEntryInput,
} from "@/lib/api/finance";
import { invalidateFinanceQueries } from "./finance-shared";
import type { FinanceLedgerSupabaseClient, SupabaseClientState } from "./finance-types";

const NOT_SAVABLE_MESSAGE = "이 화면에서는 저장할 수 없습니다.";

export type LedgerMutationHandlers = {
  registerManualLedgerEntry?: (input: RegisterManualLedgerEntryInput) => void | Promise<void>;
  updateLedgerEntry?: (input: LedgerEntry) => void | Promise<void>;
  deleteLedgerEntry?: (input: { ledgerId: string }) => void | Promise<void>;
};

/**
 * 저장 경로를 고른다. 주입된 핸들러(데모·테스트)가 있으면 그것을, 없으면 Supabase 클라이언트를 쓴다.
 * 데모 화면인데 핸들러가 없으면 저장된 척하지 않고 실패로 알린다.
 */
function resolveWriter(
  clientState: SupabaseClientState | null,
): FinanceLedgerSupabaseClient {
  if (!clientState) {
    throw new Error(NOT_SAVABLE_MESSAGE);
  }

  if (!clientState.client) {
    throw clientState.error;
  }

  return clientState.client;
}

export function useLedgerMutations({
  academyId,
  clientState,
  handlers,
  onDeleteSettled,
  onRegistered,
  onUpdated,
}: {
  academyId: string;
  /** 데모·테스트처럼 조회를 주입받은 화면은 null이다. */
  clientState: SupabaseClientState | null;
  handlers: LedgerMutationHandlers;
  onDeleteSettled: () => void;
  onRegistered: () => void;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => invalidateFinanceQueries(queryClient, academyId);

  const register = useMutation({
    mutationFn: async (input: RegisterManualLedgerEntryInput) => {
      if (handlers.registerManualLedgerEntry) {
        await handlers.registerManualLedgerEntry(input);
        return;
      }

      await registerManualLedgerEntryApi(resolveWriter(clientState), { ...input, academyId });
    },
    onSuccess: () => {
      onRegistered();
      toast.success("수동 입출금을 등록했습니다.");
      refresh();
    },
    onError: (error) => {
      toast.error("수동 입출금 등록에 실패했습니다.", { description: toUserMessage(error) });
    },
  });

  const update = useMutation({
    mutationFn: async (entry: LedgerEntry) => {
      if (handlers.updateLedgerEntry) {
        await handlers.updateLedgerEntry(entry);
        return;
      }

      await updateFinanceLedgerEntryApi(resolveWriter(clientState), {
        ledgerId: entry.ledgerId,
        academyId: entry.academyId,
        occurredOn: entry.occurredOn,
        type: entry.type,
        source: entry.source,
        category: entry.category ?? toDefaultLedgerCategory(entry.source),
        amount: entry.amount,
        description: entry.description,
      });
    },
    onSuccess: () => {
      onUpdated();
      toast.success("입출금 내역을 수정했습니다.");
      refresh();
    },
    onError: (error) => {
      toast.error("입출금 내역 수정에 실패했습니다.", { description: toUserMessage(error) });
    },
  });

  const remove = useMutation({
    mutationFn: async (entry: LedgerEntry) => {
      if (handlers.deleteLedgerEntry) {
        await handlers.deleteLedgerEntry({ ledgerId: entry.ledgerId });
        return;
      }

      await deleteFinanceLedgerEntryApi(resolveWriter(clientState), {
        ledgerId: entry.ledgerId,
        academyId: entry.academyId,
      });
    },
    onSuccess: () => {
      toast.success("입출금 내역을 삭제했습니다.");
    },
    onError: (error) => {
      toast.error("입출금 내역 삭제에 실패했습니다.", { description: toUserMessage(error) });
    },
    // 이미 지워진 내역이어도 목록이 옛 상태로 남지 않도록 항상 다시 불러온다.
    onSettled: () => {
      onDeleteSettled();
      refresh();
    },
  });

  return { register, update, remove };
}
