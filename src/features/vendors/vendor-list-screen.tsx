"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { RotateCcw, UserPlus } from "lucide-react";
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
import { DateField } from "@/components/operations/date-time-fields";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ListView } from "@/domain/common-list";
import type {
  BuildVendorListOptions,
  VendorListRow,
} from "@/domain/vendor-list";
import {
  createVendorListQueryOptions,
  registerVendor as registerVendorApi,
  type RegisterVendorInput,
  type VendorMutationSupabaseClient,
  type VendorListSupabaseClient,
} from "@/lib/api/vendors";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type VendorListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<VendorListRow>>;
};

export type VendorListQueryOptionsFactory = (
  options: BuildVendorListOptions,
) => VendorListQueryOptions;

type VendorListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: VendorListQueryOptionsFactory;
  registerVendor?: (input: {
    name: string;
    contact: string;
    kind: string;
    memo: string;
    registeredAt: string;
  }) => void | Promise<void>;
};

type VendorSupabaseClient = VendorListSupabaseClient & VendorMutationSupabaseClient;

type SupabaseClientState =
  | {
      client: VendorSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

export function VendorListScreen({
  academyId,
  queryOptionsFactory,
  registerVendor,
}: VendorListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createVendorListSupabaseClient()),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildVendorListOptions = {
    academyId,
    search,
    filters: {
      kind: kind || undefined,
    },
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const vendorListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const registerMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      contact: string;
      kind: string;
      memo: string;
      registeredAt: string;
    }) => {
      if (registerVendor) {
        await registerVendor(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await registerVendorApi(supabaseClientState.client, {
        academyId,
        name: input.name,
        contact: input.contact,
        kind: input.kind,
        memo: input.memo,
      } satisfies RegisterVendorInput);
    },
    onSuccess: () => {
      setIsRegistrationOpen(false);
      toast.success("거래처를 등록했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "vendors"],
      });
    },
    onError: (error) => {
      toast.error("거래처 등록에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const vendors = vendorListQuery.data?.items ?? [];
  const filterOptions = buildFilterOptions(vendorListQuery.data?.items ?? []);
  const registrationAction = useMemo(
    () => (
      <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
        <DialogTrigger asChild>
          <Button type="button">
            <UserPlus aria-hidden="true" />
            거래처 등록
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>거래처 등록</DialogTitle>
            <DialogDescription>
              악기, 교재, 수리 등 운영 거래처를 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <VendorRegistrationForm
            onSubmit={(input) => {
              registerMutation.mutate(input);
            }}
          />
        </DialogContent>
      </Dialog>
    ),
    [isRegistrationOpen, registerMutation],
  );
  const isHeaderActionMounted = usePageHeaderActions(registrationAction);

  return (
    <section className="grid gap-4" aria-label="거래처 목록">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {registrationAction}
      </PageHeaderActionFallback>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_auto]">
          <ListSearchField
            label="거래처 검색"
            value={search}
            onChange={setSearch}
            placeholder="거래처명, 연락처, 종류, 비고"
          />

          <ListFilterSelect
            label="거래처 종류 필터"
            value={kind}
            options={filterOptions.kinds}
            onChange={setKind}
          />

          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setKind("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 거래처 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {vendorListQuery.isError ? (
          <ListStatusAlert
            message="거래처 목록을 불러오지 못했습니다."
            detail={vendorListQuery.error.message}
          />
        ) : null}

        {vendorListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            거래처 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!vendorListQuery.isLoading &&
        !vendorListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <VendorListTable vendors={vendors} />
        ) : null}
      </div>
    </section>
  );
}

function VendorRegistrationForm({
  onSubmit,
}: {
  onSubmit: (input: {
    name: string;
    contact: string;
    kind: string;
    memo: string;
    registeredAt: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [kind, setKind] = useState("");
  const [memo, setMemo] = useState("");
  const [registeredAt, setRegisteredAt] = useState("2026-08-21");
  const canSubmit = Boolean(name.trim()) && Boolean(kind.trim());

  return (
    <form
      aria-label="거래처 등록 입력"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({ name, contact, kind, memo, registeredAt });
      }}
    >
      <Label className="grid gap-1">
        <span>거래처명</span>
        <Input
          aria-label="거래처명"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>연락처</span>
          <Input
            aria-label="연락처"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>종류</span>
          <Input
            aria-label="종류"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          />
        </Label>
      </div>
      <Label className="grid gap-1">
        <span>등록일</span>
        <DateField
          aria-label="등록일"
          value={registeredAt}
          onValueChange={setRegisteredAt}
        />
      </Label>
      <Label className="grid gap-1">
        <span>비고</span>
        <Input
          aria-label="비고"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
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
  options: BuildVendorListOptions,
  supabaseClientState: SupabaseClientState,
): VendorListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.vendors.list(options.academyId, {
        q: options.search,
        kind: options.filters?.kind,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createVendorListQueryOptions(supabaseClientState.client, options);
}

function createVendorListSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as VendorSupabaseClient,
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

function VendorListTable({ vendors }: { vendors: VendorListRow[] }) {
  if (vendors.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 거래처가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="거래처 목록" className="min-w-[44rem]">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">거래처</TableHead>
          <TableHead className="px-4 py-3">연락처</TableHead>
          <TableHead className="px-4 py-3">종류</TableHead>
          <TableHead className="px-4 py-3">비고</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vendors.map((vendor) => (
          <TableRow key={vendor.vendorId}>
            <TableCell className="px-4 py-3 font-medium">
              {vendor.name}
            </TableCell>
            <TableCell className="px-4 py-3">{vendor.contact || "-"}</TableCell>
            <TableCell className="px-4 py-3">{vendor.kind || "-"}</TableCell>
            <TableCell className="px-4 py-3">{vendor.memo || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
    </div>
  );
}

function buildFilterOptions(vendors: VendorListRow[]) {
  return {
    kinds: uniqueSorted(vendors.map((vendor) => vendor.kind)),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "ko"),
  );
}
