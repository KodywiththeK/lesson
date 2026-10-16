"use client";

import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Pencil, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
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
import type { VendorProfile } from "@/domain/vendor";
import type {
  BuildVendorListOptions,
  VendorListRow,
  VendorListView,
} from "@/domain/vendor-list";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  createVendorListQueryKey,
  createVendorListQueryOptions,
  registerVendor as registerVendorApi,
  updateVendor as updateVendorApi,
  type VendorMutationSupabaseClient,
  type VendorListSupabaseClient,
} from "@/lib/api/vendors";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type VendorListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<VendorListView>;
};

export type VendorListQueryOptionsFactory = (
  options: BuildVendorListOptions,
) => VendorListQueryOptions;

export type VendorUpdateInput = VendorProfile & { vendorId: string };

type VendorListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: VendorListQueryOptionsFactory;
  registerVendor?: (input: VendorProfile) => void | Promise<void>;
  updateVendor?: (input: VendorUpdateInput) => void | Promise<void>;
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
  updateVendor,
}: VendorListScreenProps) {
  const queryClient = useQueryClient();
  const { page, pageSize, goToPage, changePageSize, resetPage } =
    useListPaging();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorListRow | null>(
    null,
  );
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
    page,
    pageSize,
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
    placeholderData: keepPreviousData,
  });
  const invalidateVendors = () =>
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.academy(academyId), "vendors"],
    });
  const registerMutation = useMutation({
    mutationFn: async (input: VendorProfile) => {
      if (registerVendor) {
        await registerVendor(input);
        return;
      }

      await registerVendorApi(requireSupabaseClient(supabaseClientState), {
        academyId,
        ...input,
      });
    },
    onSuccess: () => {
      setIsRegistrationOpen(false);
      toast.success("거래처를 등록했습니다.");
      void invalidateVendors();
    },
    onError: (error) => {
      toast.error("거래처 등록에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (input: VendorUpdateInput) => {
      if (updateVendor) {
        await updateVendor(input);
        return;
      }

      await updateVendorApi(requireSupabaseClient(supabaseClientState), {
        academyId,
        ...input,
      });
    },
    onSuccess: () => {
      setEditingVendor(null);
      toast.success("거래처를 수정했습니다.");
      void invalidateVendors();
    },
    onError: (error) => {
      toast.error("거래처 수정에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const listView = vendorListQuery.data;
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
          <VendorForm
            formLabel="거래처 등록 입력"
            isSubmitting={registerMutation.isPending}
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

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    resetPage();
  }

  function changeKind(nextKind: string) {
    setKind(nextKind);
    resetPage();
  }

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
            onChange={changeSearch}
            placeholder="거래처명, 연락처, 종류, 비고"
          />

          <ListFilterSelect
            label="거래처 종류 필터"
            value={kind}
            options={listView?.kindOptions ?? []}
            onChange={changeKind}
          />

          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              changeSearch("");
              changeKind("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="거래처 목록을 불러오지 못했습니다."
            detail={toUserMessage(supabaseClientState.error)}
          />
        ) : null}

        {vendorListQuery.isError ? (
          <ListStatusAlert
            message="거래처 목록을 불러오지 못했습니다."
            detail={toUserMessage(vendorListQuery.error)}
          />
        ) : null}

        {vendorListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            거래처 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {listView && !vendorListQuery.isError ? (
          <>
            <VendorListTable
              vendors={listView.items}
              onEdit={setEditingVendor}
            />
            <ListPagination
              itemLabel="거래처"
              countUnit="곳"
              view={listView}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : null}
      </div>

      <Dialog
        open={editingVendor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingVendor(null);
          }
        }}
      >
        {editingVendor ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>거래처 수정</DialogTitle>
              <DialogDescription>
                {editingVendor.name}의 정보를 수정합니다.
              </DialogDescription>
            </DialogHeader>
            <VendorForm
              formLabel="거래처 수정 입력"
              initialVendor={editingVendor}
              isSubmitting={updateMutation.isPending}
              onSubmit={(input) => {
                updateMutation.mutate({
                  vendorId: editingVendor.vendorId,
                  ...input,
                });
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function VendorForm({
  formLabel,
  initialVendor,
  isSubmitting,
  onSubmit,
}: {
  formLabel: string;
  initialVendor?: VendorProfile;
  isSubmitting: boolean;
  onSubmit: (input: VendorProfile) => void;
}) {
  const [name, setName] = useState(initialVendor?.name ?? "");
  const [contact, setContact] = useState(initialVendor?.contact ?? "");
  const [kind, setKind] = useState(initialVendor?.kind ?? "");
  const [memo, setMemo] = useState(initialVendor?.memo ?? "");
  const canSubmit =
    Boolean(name.trim()) && Boolean(kind.trim()) && !isSubmitting;

  return (
    <form
      aria-label={formLabel}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({
          name: name.trim(),
          contact: contact.trim(),
          kind: kind.trim(),
          memo: memo.trim(),
        });
      }}
    >
      <VendorFormField label="거래처명" value={name} onChange={setName} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <VendorFormField label="연락처" value={contact} onChange={setContact} />
        <VendorFormField label="종류" value={kind} onChange={setKind} required />
      </div>
      <VendorFormField label="비고" value={memo} onChange={setMemo} />
      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}

function VendorFormField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <Label className="grid gap-1">
      <span>{required ? `${label} (필수)` : label}</span>
      <Input
        aria-label={label}
        aria-required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}

function requireSupabaseClient(supabaseClientState: SupabaseClientState | null) {
  if (!supabaseClientState?.client) {
    throw new Error("Supabase client 상태를 만들지 못했습니다.");
  }

  return supabaseClientState.client;
}

function createDefaultQueryOptions(
  options: BuildVendorListOptions,
  supabaseClientState: SupabaseClientState,
): VendorListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: createVendorListQueryKey(options),
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

function VendorListTable({
  vendors,
  onEdit,
}: {
  vendors: VendorListRow[];
  onEdit: (vendor: VendorListRow) => void;
}) {
  if (vendors.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 거래처가 없습니다.
      </p>
    );
  }

  return (
    <Table aria-label="거래처 목록">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">거래처</TableHead>
          <TableHead className="px-4 py-3">연락처</TableHead>
          <TableHead className="px-4 py-3">종류</TableHead>
          <TableHead className="px-4 py-3">비고</TableHead>
          <TableHead className="px-4 py-3">관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vendors.map((vendor) => (
          <TableRow key={vendor.vendorId}>
            <TableCell label="거래처" className="px-4 py-3 font-medium">
              {vendor.name}
            </TableCell>
            <TableCell label="연락처" className="px-4 py-3">{vendor.contact || "-"}</TableCell>
            <TableCell label="종류" className="px-4 py-3">{vendor.kind || "-"}</TableCell>
            <TableCell label="비고" className="px-4 py-3">{vendor.memo || "-"}</TableCell>
            <TableCell label="관리" className="px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`${vendor.name} 수정`}
                onClick={() => onEdit(vendor)}
              >
                <Pencil aria-hidden="true" />
                수정
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
