import type { PermissionContext } from "@/domain/permissions";

export type CurrentAcademyContext = {
  academyId: string;
  academyName: string;
  permissionContext: PermissionContext;
};

type SupabaseResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type CurrentAcademyMembershipRow = {
  academy_id: string;
  role: PermissionContext["role"];
  academies:
    | {
        id: string;
        name: string;
      }
    | Array<{
        id: string;
        name: string;
      }>
    | null;
};

export type CurrentAcademySupabaseClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: Error | null;
    }>;
  };
  from(table: "academy_members"): {
    select(select: string): {
      eq(
        column: "user_id" | "status",
        value: string,
      ): ReturnType<CurrentAcademySupabaseClient["from"]>["select"] extends (
        select: string,
      ) => infer TBuilder
        ? TBuilder
        : never;
      order(column: "created_at", options: { ascending: boolean }): {
        limit(count: number): {
          maybeSingle(): PromiseLike<
            SupabaseResult<CurrentAcademyMembershipRow>
          >;
        };
      };
    };
  };
};

export class AuthRequiredError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
    this.name = "AuthRequiredError";
  }
}

const CURRENT_ACADEMY_SELECT = "academy_id, role, academies(id, name)";

export async function fetchCurrentAcademyContext(
  supabase: CurrentAcademySupabaseClient,
): Promise<CurrentAcademyContext> {
  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    throw new Error(`사용자 세션을 확인하지 못했습니다: ${userResult.error.message}`);
  }

  const user = userResult.data.user;

  if (!user) {
    throw new AuthRequiredError();
  }

  const { data, error } = await supabase
    .from("academy_members")
    .select(CURRENT_ACADEMY_SELECT)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`현재 학원을 불러오지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("활성 학원 멤버십이 없습니다.");
  }

  const academy = Array.isArray(data.academies)
    ? data.academies[0]
    : data.academies;

  if (!academy) {
    throw new Error("학원 정보를 찾지 못했습니다.");
  }

  return {
    academyId: data.academy_id,
    academyName: academy.name,
    permissionContext: {
      role: data.role,
    },
  };
}
