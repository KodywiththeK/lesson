import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const legacyOwnerId = "11111111-1111-1111-1111-111111111111";
const legacyAcademyId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const legacyEmail = "owner@lesson.local";

type EmailIdentity = Parameters<ReturnType<typeof createSupabaseBrowserClient>["auth"]["unlinkIdentity"]>[0];
type RetirementStatus =
  | { state: "ineligible" }
  | { state: "needs-kakao" }
  | { state: "needs-review" }
  | { state: "ready" | "complete"; academyName: string };

type Account =
  | { state: "ineligible" | "needs-kakao" | "needs-review" }
  | { state: "ready"; academyName: string; emailIdentity: EmailIdentity | null }
  | { state: "complete"; academyName: string };

type BooleanRpc = { rpc(name: string): Promise<{ data: boolean | null; error: { message: string } | null }> };

async function callBooleanRpc(name: string): Promise<boolean> {
  const client = createSupabaseBrowserClient() as unknown as BooleanRpc;
  const { data, error } = await client.rpc(name);
  if (error) throw new Error(error.message);
  if (typeof data !== "boolean") throw new Error("계정 정리 결과를 확인하지 못했습니다.");
  return data;
}

async function readLegacyOwnerAccount(): Promise<Account> {
  const client = createSupabaseBrowserClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (userData.user?.id !== legacyOwnerId) return { state: "ineligible" };

  const { data: member, error: memberError } = await client.from("academy_members")
    .select("id, academies(name)")
    .eq("academy_id", legacyAcademyId)
    .eq("user_id", legacyOwnerId)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) return { state: "ineligible" };

  const { data: identitiesData, error: identitiesError } = await client.auth.getUserIdentities();
  if (identitiesError) throw identitiesError;
  const identities = identitiesData.identities;
  if (!identities.some((identity) => identity.provider === "kakao")) return { state: "needs-kakao" };

  const academy = Array.isArray(member.academies) ? member.academies[0] : member.academies;
  const academyName = academy?.name ?? "기존 학원";
  const emailIdentity = identities.find((identity) => identity.provider === "email") ?? null;
  const passwordRemoved = await callBooleanRpc("legacy_owner_password_removed");
  if (passwordRemoved && !emailIdentity && (!userData.user.email || userData.user.email.toLowerCase() === legacyEmail)) {
    return { state: "needs-review" };
  }
  if (passwordRemoved && !emailIdentity) return { state: "complete", academyName };
  return { state: "ready", academyName, emailIdentity };
}

export async function getLegacyOwnerRetirementStatus(): Promise<RetirementStatus> {
  const account = await readLegacyOwnerAccount();
  if (account.state !== "ready") return account;
  return { state: "ready", academyName: account.academyName };
}

export async function retireLegacyOwnerEmail(): Promise<RetirementStatus> {
  const account = await readLegacyOwnerAccount();
  if (account.state === "complete") return account;
  if (account.state !== "ready") throw new Error("기존 원장과 카카오 계정 연결을 먼저 확인해 주세요.");

  if (!await callBooleanRpc("retire_legacy_owner_password")) {
    throw new Error("기존 비밀번호를 제거하지 못했습니다.");
  }

  if (account.emailIdentity) {
    const client = createSupabaseBrowserClient();
    const { error } = await client.auth.unlinkIdentity(account.emailIdentity);
    if (error) throw error;
  }

  const result = await getLegacyOwnerRetirementStatus();
  if (result.state !== "complete") throw new Error("이메일 로그인 정보가 완전히 제거됐는지 확인하지 못했습니다.");
  return result;
}
