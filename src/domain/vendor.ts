/** 거래처 등록·수정 폼이 다루는 입력값. */
export type VendorProfile = {
  name: string;
  contact: string;
  kind: string;
  memo: string;
};

export type RegisterVendorInput = VendorProfile & {
  academyId: string;
  vendorId: string;
};

export type VendorRecord = RegisterVendorInput & {
  active: true;
};

export function registerVendor(input: RegisterVendorInput): VendorRecord {
  const name = input.name.trim();
  const kind = input.kind.trim();

  if (!name) {
    throw new Error("거래처명은 필수입니다.");
  }

  if (!kind) {
    throw new Error("거래처 종류는 필수입니다.");
  }

  return {
    academyId: input.academyId,
    vendorId: input.vendorId,
    name,
    contact: input.contact.trim(),
    kind,
    memo: input.memo.trim(),
    active: true,
  };
}
