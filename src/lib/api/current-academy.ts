import type { PermissionContext } from "@/domain/permissions";
import { chooseActiveAcademy, type ActiveAcademy } from "@/domain/auth-onboarding";

export type CurrentAcademyContext = {
  academyId: string;
  academyName: string;
  permissionContext: PermissionContext;
  availableAcademies: ActiveAcademy[];
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
    select(select: string): CurrentAcademyMembershipQuery;
  };
};

type CurrentAcademyMembershipQuery = {
  eq(column: "user_id" | "status", value: string): CurrentAcademyMembershipQuery;
  order(column: "created_at", options: { ascending: boolean }): PromiseLike<SupabaseResult<CurrentAcademyMembershipRow[]>>;
};

export class AuthRequiredError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
    this.name = "AuthRequiredError";
  }
}

export class NoMembershipError extends Error {
  constructor() {
    super("활성 학원 멤버십이 없습니다.");
    this.name = "NoMembershipError";
  }
}

export class AcademySelectionRequiredError extends Error {
  constructor(readonly memberships: ActiveAcademy[]) {
    super("사용할 학원을 선택해 주세요.");
    this.name = "AcademySelectionRequiredError";
  }
}

/**
 * Supabase는 로그인하지 않은 방문에 `user: null`이 아니라 "Auth session missing!" 오류를 돌려주고,
 * 세션이 만료되거나 지워진 경우에도 토큰 오류를 돌려준다. 모두 "다시 로그인하면 되는" 상태다.
 * 네트워크 오류 같은 다른 문제는 로그인 폼 뒤에 숨기지 않는다.
 */
const SIGNED_OUT_ERROR_NAMES = new Set(["AuthSessionMissingError", "AuthInvalidJwtError"]);
const SIGNED_OUT_ERROR_MESSAGE =
  /auth session missing|refresh token|jwt expired|invalid jwt|jwt does not exist|sub claim in jwt does not exist/i;

function isSignedOutError(error: Error) {
  return SIGNED_OUT_ERROR_NAMES.has(error.name) || SIGNED_OUT_ERROR_MESSAGE.test(error.message);
}

const CURRENT_ACADEMY_SELECT = "academy_id, role, academies(id, name)";

export async function fetchCurrentAcademyContext(
  supabase: CurrentAcademySupabaseClient,
  selectedAcademyId: string | null = null,
): Promise<CurrentAcademyContext> {
  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    // 로그인하지 않았거나 세션이 만료·손상된 방문은 오류 화면이 아니라 로그인 화면으로 보낸다.
    if (isSignedOutError(userResult.error)) {
      throw new AuthRequiredError();
    }

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
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`현재 학원을 불러오지 못했습니다: ${error.message}`);
  }

  if (!data?.length) {
    throw new NoMembershipError();
  }

  const memberships: ActiveAcademy[] = data.flatMap((row) => {
    const academy = Array.isArray(row.academies) ? row.academies[0] : row.academies;
    return academy ? [{ academyId: row.academy_id, academyName: academy.name, role: row.role as ActiveAcademy["role"] }] : [];
  });
  const selected = chooseActiveAcademy(memberships, selectedAcademyId);
  if (!selected) throw new AcademySelectionRequiredError(memberships);

  return {
    academyId: selected.academyId,
    academyName: selected.academyName,
    permissionContext: {
      role: selected.role,
    },
    availableAcademies: memberships,
  };
}
