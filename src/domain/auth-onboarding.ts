import type { AcademyRole } from "./permissions";

export type ActiveAcademy = {
  academyId: string;
  academyName: string;
  role: AcademyRole;
};

export const academyRoleLabels: Record<AcademyRole, string> = {
  owner: "원장",
  desk: "데스크",
  teacher: "선생님",
};

export type JoinRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type JoinDisplayStatus = "대기" | "활성" | "비활성" | "반려";

export function normalizeKoreanMobile(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

export function chooseActiveAcademy(
  memberships: ActiveAcademy[],
  lastAcademyId: string | null,
): ActiveAcademy | null {
  if (lastAcademyId) {
    return memberships.find((membership) => membership.academyId === lastAcademyId) ?? null;
  }

  return memberships.length === 1 ? memberships[0] : null;
}

export function resolveJoinDisplayStatus(input: {
  membershipStatus?: "active" | "disabled";
  requestStatus?: JoinRequestStatus;
}): JoinDisplayStatus | null {
  if (input.membershipStatus === "active") return "활성";
  if (input.membershipStatus === "disabled") return "비활성";
  if (input.requestStatus === "pending") return "대기";
  if (input.requestStatus === "rejected") return "반려";
  return null;
}
