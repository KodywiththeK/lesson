import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  ReceiptText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { mainNavigation, type NavigationItem } from "@/domain/navigation";
import {
  type FeatureKey,
  type PermissionContext,
  canAccessFeature,
} from "@/domain/permissions";

type AppShellProps = {
  academyName: string;
  permissionContext: PermissionContext;
  pageTitle?: string;
  children?: ReactNode;
};

type WorkQueueItem = {
  label: string;
  value: string;
  tone: string;
  icon: typeof ClipboardCheck;
  feature?: FeatureKey;
};

const workQueue: WorkQueueItem[] = [
  {
    label: "오늘 출석 확인",
    value: "12건",
    tone: "bg-accent text-accent-foreground",
    icon: ClipboardCheck,
  },
  {
    label: "회차권 임박",
    value: "5명",
    tone: "bg-secondary text-secondary-foreground",
    icon: CalendarCheck,
  },
  {
    label: "미납 확인",
    value: "3건",
    tone: "bg-destructive/10 text-destructive",
    icon: AlertCircle,
    feature: "income-management",
  },
];

const nextMilestones = [
  "Supabase tenant/RLS",
  "역할별 권한 메뉴",
  "shadcn 운영 화면",
  "목록/검색/필터",
];

type VisibleNavigationItem = NavigationItem & {
  children?: VisibleNavigationItem[];
};

export function AppShell({
  academyName,
  permissionContext,
  pageTitle = "음악학원 관리",
  children,
}: AppShellProps) {
  const visibleNavigation = getVisibleNavigation(permissionContext);
  const visibleWorkQueue = workQueue.filter((item) => {
    if (!item.feature) {
      return true;
    }

    return canAccessFeature(permissionContext, item.feature);
  });
  const showPaymentAction = canAccessFeature(
    permissionContext,
    "income-management",
  );
  const showAttendanceAction = canAccessFeature(
    permissionContext,
    "lesson-schedule",
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[16rem_1fr]">
        <aside className="min-w-0 border-b border-border bg-card px-4 py-3 lg:border-b-0 lg:border-r lg:py-4">
          <div className="mb-3 lg:mb-6">
            <p className="text-xs font-semibold text-muted-foreground">
              Service Console
            </p>
            <h2 className="text-lg font-semibold">학원 운영</h2>
          </div>
          <nav
            aria-label="주요 메뉴"
            className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0"
          >
            {visibleNavigation.map((item) => (
              <NavigationEntry key={item.href} item={item} />
            ))}
            {permissionContext.role === "teacher" ? (
              <Link
                href="/my/payroll"
                className="group flex min-h-10 flex-none items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:min-h-11 lg:gap-3"
              >
                <ReceiptText aria-hidden="true" className="size-4" />
                <span>내 급여</span>
              </Link>
            ) : null}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="border-b border-border px-5 py-5 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  현재 학원: {academyName}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl">
                  {pageTitle}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {showPaymentAction ? (
                  <Button asChild variant="outline">
                    <Link href="/finance">
                      <ReceiptText aria-hidden="true" />
                      수납 등록
                    </Link>
                  </Button>
                ) : null}
                {showAttendanceAction ? (
                  <Button asChild>
                    <Link href="/lessons">
                      <ClipboardCheck aria-hidden="true" />
                      출석 확인
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </header>

          <div className="grid min-w-0 gap-6 px-5 py-6 md:px-8 [&>*]:min-w-0">
            {children ?? <DashboardContent visibleWorkQueue={visibleWorkQueue} />}
          </div>
        </section>
      </div>
    </main>
  );
}

function getVisibleNavigation(
  permissionContext: PermissionContext,
): VisibleNavigationItem[] {
  return mainNavigation.flatMap((item) => {
    const visibleChildren = item.children?.filter((child) =>
      isNavigationItemVisible(child, permissionContext),
    );
    const visibleItem = {
      ...item,
      children: visibleChildren,
    };

    if (isNavigationItemVisible(visibleItem, permissionContext)) {
      return [visibleItem];
    }

    return [];
  });
}

function isNavigationItemVisible(
  item: NavigationItem,
  permissionContext: PermissionContext,
): boolean {
  if (item.href === "/") {
    return true;
  }

  if (item.feature) {
    return canAccessFeature(permissionContext, item.feature);
  }

  return item.children?.some((child) =>
    isNavigationItemVisible(child, permissionContext),
  ) === true;
}

function NavigationEntry({ item }: { item: VisibleNavigationItem }) {
  if (item.children?.length) {
    return (
      <div className="flex flex-none gap-1 lg:grid lg:gap-0.5">
        <NavigationLink item={item} />
        <div className="flex gap-1 lg:grid lg:pl-5">
          {item.children.map((child) => (
            <NavigationLink key={child.href} item={child} variant="child" />
          ))}
        </div>
      </div>
    );
  }

  return <NavigationLink item={item} />;
}

function NavigationLink({
  item,
  variant = "default",
}: {
  item: NavigationItem;
  variant?: "default" | "child";
}) {
  const Icon = item.icon;
  const sizeClass =
    variant === "child"
      ? "min-h-9 px-3 text-xs lg:min-h-9"
      : "min-h-10 px-3 text-sm lg:min-h-11";

  return (
    <Link
      href={item.href}
      className={`group flex flex-none items-center gap-2 rounded-md font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:gap-3 ${sizeClass}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span>{item.label}</span>
    </Link>
  );
}

function DashboardContent({
  visibleWorkQueue,
}: {
  visibleWorkQueue: WorkQueueItem[];
}) {
  return (
    <>
      <section aria-label="운영 대기열" className="grid gap-3 md:grid-cols-3">
        {visibleWorkQueue.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`flex size-9 items-center justify-center rounded-md ${item.tone}`}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <p className="text-2xl font-semibold">{item.value}</p>
              </div>
              <h3 className="mt-4 text-sm font-medium">{item.label}</h3>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="text-base font-semibold">우선 개발 흐름</h2>
          </div>
          <div className="divide-y divide-border">
            {nextMilestones.map((milestone, index) => (
              <div
                key={milestone}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {index === 0 ? "진행 중" : `${index + 1}단계`}
                  </p>
                  <p className="mt-1 text-sm font-medium">{milestone}</p>
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">핵심 규칙</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            레슨 일정 등록만으로 회차권을 차감하지 않고, 실제 등원 확인
            시점에만 1회를 차감한다. 결석은 회차를 차감하지 않는다.
          </p>
        </div>
      </section>
    </>
  );
}
