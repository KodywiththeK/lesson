import type { VendorProfile } from "@/domain/vendor";
import {
  buildVendorList,
  type BuildVendorListOptions,
  type VendorListRow,
  type VendorListView,
} from "@/domain/vendor-list";

import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type VendorSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  phone: string | null;
  vendor_type: string | null;
  note: string | null;
};

type VendorListSelectBuilder = {
  eq(
    column: "academy_id",
    value: string,
  ): PromiseLike<SupabaseQueryResult<VendorSupabaseRow[]>>;
};

type VendorListFromBuilder = {
  select(select: string): VendorListSelectBuilder;
};

export type VendorListSupabaseClient = {
  from(table: "vendors"): VendorListFromBuilder;
};

export type FetchVendorListOptions = BuildVendorListOptions;

export type RegisterVendorInput = VendorProfile & {
  academyId: string;
};

export type UpdateVendorInput = RegisterVendorInput & {
  vendorId: string;
};

type VendorSelectBuilder = {
  select(select: string): {
    single(): PromiseLike<SupabaseQueryResult<VendorSupabaseRow>>;
  };
};

export type VendorMutationSupabaseClient = {
  from(table: "vendors"): {
    insert(values: Record<string, unknown>): VendorSelectBuilder;
    update(values: Record<string, unknown>): {
      eq(
        column: "academy_id",
        value: string,
      ): {
        eq(column: "id", value: string): VendorSelectBuilder;
      };
    };
  };
};

const VENDOR_LIST_SELECT = "id, academy_id, name, phone, vendor_type, note";

export async function fetchVendorList(
  supabase: VendorListSupabaseClient,
  options: FetchVendorListOptions,
): Promise<VendorListView> {
  const { data, error } = await supabase
    .from("vendors")
    .select(VENDOR_LIST_SELECT)
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`거래처 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildVendorList((data ?? []).map(toVendorListRow), options);
}

export function createVendorListQueryKey(options: FetchVendorListOptions) {
  return queryKeys.vendors.list(options.academyId, {
    q: options.search,
    kind: options.filters?.kind,
    page: options.page?.toString(),
    pageSize: options.pageSize?.toString(),
  });
}

export function createVendorListQueryOptions(
  supabase: VendorListSupabaseClient,
  options: FetchVendorListOptions,
) {
  return {
    queryKey: createVendorListQueryKey(options),
    queryFn: () => fetchVendorList(supabase, options),
  };
}

export async function registerVendor(
  supabase: VendorMutationSupabaseClient,
  input: RegisterVendorInput,
): Promise<VendorListRow> {
  const { data, error } = await supabase
    .from("vendors")
    .insert({ academy_id: input.academyId, ...toVendorWriteValues(input) })
    .select(VENDOR_LIST_SELECT)
    .single();

  if (error) {
    throw new Error(`거래처를 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("거래처를 등록했지만 반환된 데이터가 없습니다.");
  }

  return toVendorListRow(data);
}

export async function updateVendor(
  supabase: VendorMutationSupabaseClient,
  input: UpdateVendorInput,
): Promise<VendorListRow> {
  const { data, error } = await supabase
    .from("vendors")
    .update(toVendorWriteValues(input))
    .eq("academy_id", input.academyId)
    .eq("id", input.vendorId)
    .select(VENDOR_LIST_SELECT)
    .single();

  if (error) {
    throw new Error(`거래처를 수정하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("거래처를 수정했지만 반환된 데이터가 없습니다.");
  }

  return toVendorListRow(data);
}

function toVendorWriteValues(profile: VendorProfile) {
  return {
    name: profile.name,
    phone: profile.contact || null,
    vendor_type: profile.kind || null,
    note: profile.memo || null,
  };
}

function toVendorListRow(row: VendorSupabaseRow): VendorListRow {
  return {
    academyId: row.academy_id,
    vendorId: row.id,
    name: row.name,
    contact: row.phone ?? "",
    kind: row.vendor_type ?? "",
    memo: row.note ?? "",
  };
}
