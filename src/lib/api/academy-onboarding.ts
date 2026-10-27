import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcClient = { rpc(name: string, args?: Record<string, unknown>): Promise<RpcResult> };

export type MyJoinRequest = {
  id: string;
  academy_id: string;
  academy_name: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  membership_status: "active" | "disabled" | null;
  created_at: string;
};

export type OwnerJoinRequest = {
  id: string;
  applicant_name: string;
  applicant_phone: string;
  source: "invite" | "code";
  status: MyJoinRequest["status"];
  created_at: string;
};

export type StaffMember = {
  member_id: string;
  display_name: string;
  phone: string | null;
  role: "desk" | "teacher";
  status: "active" | "disabled";
  teacher_id: string | null;
};

export type JoinInvite = {
  id: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
};

export type AvailableTeacherRecord = { id: string; name: string; member_id: string | null };

async function callRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const client = createSupabaseBrowserClient() as unknown as RpcClient;
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function createAcademy(input: { academyName: string; name: string; phone: string }) {
  return callRpc<Array<{ academy_id: string; join_code: string }>>("create_academy_with_owner", {
    p_academy_name: input.academyName,
    p_name: input.name,
    p_phone: input.phone,
  });
}

export function submitJoinRequest(input: {
  source: "invite" | "code";
  secret: string;
  name: string;
  phone: string;
}) {
  return callRpc<string>("submit_academy_join_request", {
    p_source: input.source,
    p_secret: input.secret,
    p_name: input.name,
    p_phone: input.phone,
  });
}

export function listMyJoinRequests() {
  return callRpc<MyJoinRequest[]>("list_my_academy_join_requests");
}

export function withdrawJoinRequest(requestId: string) {
  return callRpc<void>("withdraw_academy_join_request", { p_request_id: requestId });
}

export function listOwnerJoinRequests(academyId: string) {
  return callRpc<OwnerJoinRequest[]>("list_owner_academy_join_requests", { p_academy_id: academyId });
}

export function listStaff(academyId: string) {
  return callRpc<StaffMember[]>("list_academy_staff", { p_academy_id: academyId });
}

export async function listAvailableTeacherRecords(academyId: string): Promise<AvailableTeacherRecord[]> {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("teachers")
    .select("id, name, member_id, status, archived_at")
    .eq("academy_id", academyId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<AvailableTeacherRecord & { status: string; archived_at: string | null }>)
    .filter((teacher) => teacher.status === "employed" && teacher.archived_at === null);
}

export function listInvites(academyId: string) {
  return callRpc<JoinInvite[]>("list_academy_join_invites", { p_academy_id: academyId });
}

export function createInvite(academyId: string) {
  return callRpc<Array<{ invite_id: string; invite_token: string }>>("create_academy_join_invite", { p_academy_id: academyId });
}

export function revokeInvite(academyId: string, inviteId: string) {
  return callRpc<void>("revoke_academy_join_invite", { p_academy_id: academyId, p_invite_id: inviteId });
}

export function rotateJoinCode(academyId: string) {
  return callRpc<string>("rotate_academy_join_code", { p_academy_id: academyId });
}

export function reviewJoinRequest(input: {
  requestId: string;
  approve: boolean;
  role?: "desk" | "teacher";
  teacherId?: string;
}) {
  return callRpc<string | null>("review_academy_join_request", {
    p_request_id: input.requestId,
    p_approve: input.approve,
    p_role: input.role ?? null,
    p_teacher_id: input.teacherId ?? null,
  });
}

export function setStaffActive(memberId: string, active: boolean) {
  return callRpc<void>("set_academy_staff_active", { p_member_id: memberId, p_active: active });
}

export function setStaffRole(memberId: string, role: "desk" | "teacher", teacherId?: string) {
  return callRpc<void>("set_academy_staff_role", {
    p_member_id: memberId,
    p_role: role,
    p_teacher_id: teacherId ?? null,
  });
}
