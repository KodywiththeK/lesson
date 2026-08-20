import {
  buildListView,
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

export function buildVendorList(
  vendors: VendorListRow[],
  options: BuildVendorListOptions,
): ListView<VendorListRow> {
  const scopedVendors = vendors
    .filter((vendor) => vendor.academyId === options.academyId)
    .filter((vendor) => matchesVendorFilters(vendor, options.filters));

  return buildListView(scopedVendors, {
    getName: (vendor) => vendor.name,
    search: options.search,
    searchFields: [
      (vendor) => vendor.name,
      (vendor) => vendor.contact,
      (vendor) => vendor.kind,
      (vendor) => vendor.memo,
    ],
    page: options.page,
    pageSize: options.pageSize,
  });
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
