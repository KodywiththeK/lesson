import {
  buildListView,
  compareKoreanNames,
  type ListView,
  type PageSizeOption,
} from "./common-list";

export type VendorListRow = {
  academyId: string;
  vendorId: string;
  name: string;
  contact: string;
  kind: string;
  memo: string;
};

export type VendorListFilters = {
  kind?: string;
};

export type BuildVendorListOptions = {
  academyId: string;
  search?: string;
  filters?: VendorListFilters;
  page?: number;
  pageSize?: PageSizeOption;
};

export type VendorListView = ListView<VendorListRow> & {
  /** 종류 필터 선택지. 검색·필터·페이지와 상관없이 같은 학원 전체 거래처의 종류다. */
  kindOptions: string[];
};

export function buildVendorList(
  vendors: VendorListRow[],
  options: BuildVendorListOptions,
): VendorListView {
  const academyVendors = vendors.filter(
    (vendor) => vendor.academyId === options.academyId,
  );
  const listView = buildListView(
    academyVendors.filter((vendor) =>
      matchesVendorFilters(vendor, options.filters),
    ),
    {
      getName: (vendor) => vendor.name,
      getTieBreaker: (vendor) => vendor.vendorId,
      search: options.search,
      searchFields: [
        (vendor) => vendor.name,
        (vendor) => vendor.contact,
        (vendor) => vendor.kind,
        (vendor) => vendor.memo,
      ],
      page: options.page,
      pageSize: options.pageSize,
    },
  );

  return { ...listView, kindOptions: buildKindOptions(academyVendors) };
}

function buildKindOptions(vendors: VendorListRow[]) {
  return [...new Set(vendors.map((vendor) => vendor.kind).filter(Boolean))].sort(
    compareKoreanNames,
  );
}

function matchesVendorFilters(
  vendor: VendorListRow,
  filters: VendorListFilters | undefined,
) {
  if (!filters) {
    return true;
  }

  return !filters.kind || vendor.kind === filters.kind;
}
