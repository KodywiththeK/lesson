export type AcademyRole = "owner" | "desk" | "teacher";
export type SessionRole = AcademyRole | "anonymous";
export type MembershipStatus = "active" | "invited" | "disabled";

export type AcademyMembership = {
  academyId: string;
  role: AcademyRole;
  status: MembershipStatus;
};

export type ResolveSessionRoleInput = {
  userId: string;
  academyId: string;
  memberships: AcademyMembership[];
};

export type PermissionContext = {
  role: SessionRole;
  teacherId?: string;
  assignedStudentIds?: string[];
};

export type FeatureKey =
  | "lesson-schedule"
  | "students"
  | "teachers"
  | "status-management"
  | "vendors"
  | "consultations"
  | "books"
  | "tickets"
  | "income-management"
  | "manual-ledger"
  | "settings"
  | "ticket-manual-adjustment"
  | "ticket-payment-input"
  | "assigned-student"
  | "own-payroll";

export type FeatureTarget = {
  studentId?: string;
  teacherId?: string;
};

const OWNER_FEATURES: FeatureKey[] = [
  "lesson-schedule",
  "students",
  "teachers",
  "status-management",
  "vendors",
  "consultations",
  "books",
  "tickets",
  "ticket-manual-adjustment",
  "ticket-payment-input",
  "income-management",
  "manual-ledger",
  "settings",
  "assigned-student",
  "own-payroll",
];

const DESK_FEATURES: FeatureKey[] = [
  "lesson-schedule",
  "students",
  "teachers",
  "status-management",
  "vendors",
  "consultations",
  "books",
  "tickets",
  "ticket-manual-adjustment",
  "ticket-payment-input",
  "assigned-student",
];

const TEACHER_BASE_FEATURES: FeatureKey[] = [
  "lesson-schedule",
  "students",
  "assigned-student",
  "own-payroll",
];

export function resolveSessionRole(input: ResolveSessionRoleInput): SessionRole {
  return (
    input.memberships.find(
      (membership) =>
        membership.academyId === input.academyId &&
        membership.status === "active",
    )?.role ?? "anonymous"
  );
}

export function canAccessFeature(
  context: PermissionContext,
  feature: FeatureKey,
  target: FeatureTarget = {},
) {
  if (context.role === "anonymous") {
    return false;
  }

  if (context.role === "owner") {
    return OWNER_FEATURES.includes(feature);
  }

  if (context.role === "desk") {
    return DESK_FEATURES.includes(feature);
  }

  if (!TEACHER_BASE_FEATURES.includes(feature)) {
    return false;
  }

  if (feature === "assigned-student") {
    return Boolean(
      target.studentId &&
        context.assignedStudentIds?.includes(target.studentId),
    );
  }

  if (feature === "own-payroll") {
    return Boolean(target.teacherId && target.teacherId === context.teacherId);
  }

  return feature === "lesson-schedule" || feature === "students";
}

export function getVisibleNavigationItems(context: PermissionContext) {
  const candidates: FeatureKey[] = [
    "lesson-schedule",
    "students",
    "teachers",
    "status-management",
    "vendors",
    "consultations",
    "books",
    "tickets",
    "income-management",
    "settings",
    "own-payroll",
  ];

  return candidates.filter((feature) => {
    if (feature === "own-payroll") {
      return context.role === "teacher";
    }

    return canAccessFeature(context, feature);
  });
}
