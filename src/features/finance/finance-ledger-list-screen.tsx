"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { CircleDollarSign, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LedgerEntry } from "@/domain/book-sale";
import {
  formatLedgerEntrySource,
  formatLedgerEntryType,
  type BuildFinanceLedgerListOptions,
} from "@/domain/finance-ledger";
import {
  createFinanceLedgerListQueryOptions,
  registerManualLedgerEntry as registerManualLedgerEntryApi,
  type FinanceLedgerMutationSupabaseClient,
  type FinanceLedgerListSupabaseClient,
  type RegisterManualLedgerEntryInput,
} from "@/lib/api/finance";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type FinanceLedgerListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<LedgerEntry[]>;
};

export type FinanceLedgerListQueryOptionsFactory = (
  options: BuildFinanceLedgerListOptions,
) => FinanceLedgerListQueryOptions;

type FinanceLedgerListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: FinanceLedgerListQueryOptionsFactory;
  registerManualLedgerEntry?: (input: {
    occurredOn: string;
    type: LedgerEntry["type"];
    amount: number;
    description: string;
  }) => void | Promise<void>;
};

type FinanceLedgerSupabaseClient = FinanceLedgerListSupabaseClient &
  FinanceLedgerMutationSupabaseClient;

type SupabaseClientState =
  | {
      client: FinanceLedgerSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

const typeFilterOptions: Array<{
  value: LedgerEntry["type"];
  label: string;
}> = [
  { value: "income", label: formatLedgerEntryType("income") },
  { value: "expense", label: formatLedgerEntryType("expense") },
];

const sourceFilterOptions: Array<{
  value: LedgerEntry["source"];
  label: string;
}> = [
  { value: "tuition", label: formatLedgerEntrySource("tuition") },
  { value: "book-sale", label: formatLedgerEntrySource("book-sale") },
  { value: "lesson-ticket", label: formatLedgerEntrySource("lesson-ticket") },
  { value: "payroll", label: formatLedgerEntrySource("payroll") },
  { value: "manual", label: formatLedgerEntrySource("manual") },
];

export function FinanceLedgerListScreen({
  academyId,
  queryOptionsFactory,
  registerManualLedgerEntry,
}: FinanceLedgerListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<LedgerEntry["type"] | "">("");
  const [source, setSource] = useState<LedgerEntry["source"] | "">("");
  const [isManualOpen, setIsManualOpen] = useState(false);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createFinanceLedgerSupabaseClient()),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildFinanceLedgerListOptions = {
    academyId,
    search,
    filters: {
      type: type || undefined,
      source: source || undefined,
    },
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const ledgerListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const registerMutation = useMutation({
    mutationFn: async (input: {
      occurredOn: string;
      type: LedgerEntry["type"];
      amount: number;
      description: string;
    }) => {
      if (registerManualLedgerEntry) {
        await registerManualLedgerEntry(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await registerManualLedgerEntryApi(supabaseClientState.client, {
        academyId,
        occurredOn: input.occurredOn,
        type: input.type,
        amount: input.amount,
        description: input.description,
      } satisfies RegisterManualLedgerEntryInput);
    },
    onSuccess: () => {
      setIsManualOpen(false);
      toast.success("수동 입출입을 등록했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "finance"],
      });
    },
    onError: (error) => {
      toast.error("수동 입출입 등록에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const entries = ledgerListQuery.data ?? [];
  const manualEntryAction = useMemo(
    () => (
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogTrigger asChild>
          <Button type="button">
            <CircleDollarSign aria-hidden="true" />
            수동 입출입 등록
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수동 입출입 등록</DialogTitle>
            <DialogDescription>
              자동 수납 외 조정 내역을 직접 기록합니다.
            </DialogDescription>
          </DialogHeader>
          <ManualLedgerForm
            onSubmit={(input) => {
              registerMutation.mutate(input);
            }}
          />
        </DialogContent>
      </Dialog>
    ),
    [isManualOpen, registerMutation],
  );
  const isHeaderActionMounted = usePageHeaderActions(manualEntryAction);

  return (
    <section className="grid gap-4" aria-label="입출입 내역">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {manualEntryAction}
      </PageHeaderActionFallback>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto]">
          <ListSearchField
            label="입출입 내역 검색"
            value={search}
            onChange={setSearch}
            placeholder="발생일, 설명, 유형, 출처"
          />
          <ListFilterSelect
            label="유형 필터"
            value={type}
            options={typeFilterOptions}
            onChange={(nextType) => setType(nextType as LedgerEntry["type"] | "")}
          />
          <ListFilterSelect
            label="출처 필터"
            value={source}
            options={sourceFilterOptions}
            onChange={(nextSource) =>
              setSource(nextSource as LedgerEntry["source"] | "")
            }
          />
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setType("");
              setSource("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 입출입 내역을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {ledgerListQuery.isError ? (
          <ListStatusAlert
            message="입출입 내역을 불러오지 못했습니다."
            detail={ledgerListQuery.error.message}
          />
        ) : null}

        {ledgerListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            입출입 내역을 불러오는 중입니다.
          </p>
        ) : null}

        {!ledgerListQuery.isLoading &&
        !ledgerListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <FinanceLedgerTable entries={entries} />
        ) : null}
      </div>
    </section>
  );
}

function ManualLedgerForm({
  onSubmit,
}: {
  onSubmit: (input: {
    occurredOn: string;
    type: LedgerEntry["type"];
    amount: number;
    description: string;
  }) => void;
}) {
  const [occurredOn, setOccurredOn] = useState("2026-08-21");
  const [type, setType] = useState<LedgerEntry["type"]>("income");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const canSubmit =
    Boolean(occurredOn) && amount > 0 && Boolean(description.trim());

  return (
    <form
      aria-label="수동 입출입 입력"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({
          occurredOn,
          type,
          amount,
          description,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>발생일</span>
          <Input
            aria-label="발생일"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>유형</span>
          <NativeSelect
            aria-label="유형"
            value={type}
            onChange={(event) => setType(event.target.value as LedgerEntry["type"])}
          >
            <NativeSelectOption value="income">수입</NativeSelectOption>
            <NativeSelectOption value="expense">지출</NativeSelectOption>
          </NativeSelect>
        </Label>
      </div>
      <Label className="grid gap-1">
        <span>금액</span>
        <Input
          aria-label="금액"
          type="number"
          min={1}
          step={1000}
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
      </Label>
      <Label className="grid gap-1">
        <span>설명</span>
        <Input
          aria-label="설명"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Label>
      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}

function createDefaultQueryOptions(
  options: BuildFinanceLedgerListOptions,
  supabaseClientState: SupabaseClientState,
): FinanceLedgerListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.finance.ledgerList(options.academyId, {
        q: options.search,
        type: options.filters?.type,
        source: options.filters?.source,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createFinanceLedgerListQueryOptions(
    supabaseClientState.client,
    options,
  );
}

function createFinanceLedgerSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as FinanceLedgerSupabaseClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function createMissingSupabaseClientState(): SupabaseClientState {
  return {
    client: null,
    error: new Error("Supabase client 상태를 만들지 못했습니다."),
  };
}

function FinanceLedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 입출입 내역이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="입출입 내역" className="min-w-[48rem]">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">발생일</TableHead>
          <TableHead className="px-4 py-3">유형</TableHead>
          <TableHead className="px-4 py-3">출처</TableHead>
          <TableHead className="px-4 py-3">금액</TableHead>
          <TableHead className="px-4 py-3">설명</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.ledgerId}>
            <TableCell className="px-4 py-3">{entry.occurredOn}</TableCell>
            <TableCell className="px-4 py-3">
              <Badge variant={entry.type === "income" ? "secondary" : "outline"}>
                {formatLedgerEntryType(entry.type)}
              </Badge>
            </TableCell>
            <TableCell className="px-4 py-3">
              {formatLedgerEntrySource(entry.source)}
            </TableCell>
            <TableCell className="px-4 py-3">{formatWon(entry.amount)}</TableCell>
            <TableCell className="px-4 py-3 font-medium">
              {entry.description}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
    </div>
  );
}

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}
