import type { ListView } from "@/domain/common-list";
import {
  buildVendorList,
  type BuildVendorListOptions,
  type VendorListRow,
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

export type RegisterVendorInput = {
  academyId: string;
  name: string;
  contact: string;
  kind: string;
  memo: string;
};

export type VendorMutationSupabaseClient = {
  from(table: "vendors"): {
    insert(values: Record<string, unknown>): {
      select(select: string): {
        single(): PromiseLike<SupabaseQueryResult<VendorSupabaseRow>>;
      };
    };
  };
};

const VENDOR_LIST_SELECT = "id, academy_id, name, phone, vendor_type, note";

export async function fetchVendorList(
  supabase: VendorListSupabaseClient,
  options: FetchVendorListOptions,
): Promise<ListView<VendorListRow>> {
  const { data, error } = await supabase
    .from("vendors")
    .select(VENDOR_LIST_SELECT)
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`거래처 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildVendorList((data ?? []).map(toVendorListRow), options);
}

export function createVendorListQueryOptions(
  supabase: VendorListSupabaseClient,
  options: FetchVendorListOptions,
) {
  return {
    queryKey: queryKeys.vendors.list(options.academyId, {
      q: options.search,
      kind: options.filters?.kind,
    }),
    queryFn: () => fetchVendorList(supabase, options),
  };
}

export async function registerVendor(
  supabase: VendorMutationSupabaseClient,
  input: RegisterVendorInput,
): Promise<VendorListRow> {
  const { data, error } = await supabase
    .from("vendors")
    .insert({
      academy_id: input.academyId,
      name: input.name,
      phone: input.contact || null,
      vendor_type: input.kind || null,
      note: input.memo || null,
    })
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
