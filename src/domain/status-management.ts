import { getFinanceToday } from "./finance-date";
import {
  buildListView,
  type ListView,
  type PageSizeOption,
} from "./common-list";

export type StatusManagementEntityType = "student" | "teacher";
export type StudentManagedStatus = "suspended" | "withdrawn";
export type TeacherManagedStatus = "on_leave" | "resigned";
export type ManagedStatus = StudentManagedStatus | TeacherManagedStatus;

export type StatusManagementRow = {
  academyId: string;
  entityType: StatusManagementEntityType;
  entityId: string;
  name: string;
  status: ManagedStatus;
  changedAt?: string | null;
  retentionUntil?: string | null;
  archivedAt?: string | null;
  primaryInfo?: string;
  secondaryInfo?: string;
  detailSummary?: string;
  statusReason?: string | null;
};

export type StatusManagementListItem = StatusManagementRow & {
  statusLabel: string;
  changedOn: string;
  daysRemaining?: number;
  archiveStateLabel: string;
};

export type BuildStatusManagementListOptions = {
  academyId: string;
  entityType: StatusManagementEntityType;
  status: ManagedStatus;
  today?: string;
  search?: string;
  page?: number;
  pageSize?: PageSizeOption;
};

/** 대상 종류는 호출하는 API가 정하므로, 화면과 API가 함께 쓰는 조회 조건에서는 뺀다. */
export type StatusManagementFetchOptions<TStatus extends ManagedStatus> = Omit<
  BuildStatusManagementListOptions,
  "entityType" | "status"
> & { status: TStatus };

export function calculateRetentionUntil({
  changedAt,
  retentionDays,
}: {
  changedAt: string;
  retentionDays: number;
}) {
  const baseDate = new Date(`${changedAt.slice(0, 10)}T00:00:00.000Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + retentionDays);

  return baseDate.toISOString().slice(0, 10);
}

export function buildStatusManagementList(
  rows: StatusManagementRow[],
  options: BuildStatusManagementListOptions,
): ListView<StatusManagementListItem> {
  const today = options.today ?? getFinanceToday();
  const items = rows
    .filter((row) => row.academyId === options.academyId)
    .filter((row) => row.entityType === options.entityType)
    .filter((row) => row.status === options.status)
    .filter((row) => !row.archivedAt)
    .map((row) => toListItem(row, today));

  return buildListView(items, {
    getName: (item) => item.name,
    getTieBreaker: (item) => item.entityId,
    search: options.search,
    searchFields: [
      (item) => item.name,
      (item) => item.statusLabel,
      (item) => item.primaryInfo ?? "",
      (item) => item.secondaryInfo ?? "",
      (item) => item.detailSummary ?? "",
      (item) => item.statusReason ?? "",
    ],
    page: options.page,
    pageSize: options.pageSize,
  });
}

export function formatManagedStatusLabel({
  entityType,
  status,
}: {
  entityType: StatusManagementEntityType;
  status: ManagedStatus;
}): string;
export function formatManagedStatusLabel(
  entityType: StatusManagementEntityType,
  status: ManagedStatus,
): string;
export function formatManagedStatusLabel(
  entityOrInput:
    | StatusManagementEntityType
    | {
        entityType: StatusManagementEntityType;
        status: ManagedStatus;
      },
  status?: ManagedStatus,
) {
  const entityType =
    typeof entityOrInput === "string" ? entityOrInput : entityOrInput.entityType;
  const targetStatus =
    typeof entityOrInput === "string" ? status : entityOrInput.status;

  if (entityType === "student") {
    return targetStatus === "suspended" ? "휴원" : "퇴원";
  }

  return targetStatus === "on_leave" ? "휴직" : "퇴사";
}

function toListItem(
  row: StatusManagementRow,
  today: string,
): StatusManagementListItem {
  const daysRemaining = row.retentionUntil
    ? calculateDaysBetween(today, row.retentionUntil)
    : undefined;

  return {
    ...row,
    statusLabel: formatManagedStatusLabel({
      entityType: row.entityType,
      status: row.status,
    }),
    changedOn: row.changedAt?.slice(0, 10) ?? "-",
    daysRemaining,
    archiveStateLabel: formatArchiveState(row.retentionUntil, daysRemaining),
  };
}

function calculateDaysBetween(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate.slice(0, 10)}T00:00:00.000Z`);
  const to = Date.parse(`${toDate.slice(0, 10)}T00:00:00.000Z`);

  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function formatArchiveState(
  retentionUntil: string | null | undefined,
  daysRemaining: number | undefined,
) {
  if (!retentionUntil) {
    return "보관 대상 아님";
  }

  return daysRemaining === 0 ? "보관 만료" : "보관 중";
}
