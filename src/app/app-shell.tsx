"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Menu,
  MoreHorizontal,
  ReceiptText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PageHeaderActionsContext,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

const compactHeaderMediaQuery = "(max-width: 767px)";

type VisibleNavigationItem = NavigationItem & {
  children?: VisibleNavigationItem[];
};

export const useAppShellHeaderActions = usePageHeaderActions;

export function AppShell({
  academyName,
  permissionContext,
  pageTitle = "음악학원 관리",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const isCompactHeader = useIsCompactHeader();
  const visibleNavigation = getVisibleNavigation(permissionContext);
  const activeRoute = getActiveRoute(visibleNavigation, pathname);
  const headerTitle = activeRoute.parent?.label ?? pageTitle;
  const headerTabs = activeRoute.parent?.children ?? [];
  const headerActionsContextValue = useMemo(
    () => ({ setHeaderActions }),
    [setHeaderActions],
  );
  const visibleWorkQueue = workQueue.filter((item) => {
    if (!item.feature) {
      return true;
    }

    return canAccessFeature(permissionContext, item.feature);
  });

  return (
    <PageHeaderActionsContext.Provider value={headerActionsContextValue}>
      <main className="min-h-screen bg-background">
        <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[16rem_1fr]">
          <DesktopSidebar
            activeHref={activeRoute.item?.href}
            academyName={academyName}
            permissionContext={permissionContext}
            visibleNavigation={visibleNavigation}
          />

          <section className="flex min-w-0 flex-col">
            <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <MobileNavigationDrawer
                    activeHref={activeRoute.item?.href}
                    academyName={academyName}
                    isOpen={isMobileNavigationOpen}
                    permissionContext={permissionContext}
                    setIsOpen={setIsMobileNavigationOpen}
                    visibleNavigation={visibleNavigation}
                  />
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
                      {headerTitle}
                    </h1>
                  </div>
                </div>
                <HeaderActions
                  actions={headerActions}
                  isCompact={isCompactHeader}
                />
              </div>
              {headerTabs.length > 0 ? (
                <HeaderSubNavigation
                  label={`${headerTitle} 하위 메뉴`}
                  activeHref={activeRoute.item?.href}
                  items={headerTabs}
                />
              ) : null}
            </header>

            <div className="grid min-w-0 gap-6 px-5 py-6 md:px-8 [&>*]:min-w-0">
              {children ?? <DashboardContent visibleWorkQueue={visibleWorkQueue} />}
            </div>
          </section>
        </div>
      </main>
    </PageHeaderActionsContext.Provider>
  );
}

function HeaderActions({
  actions,
  isCompact,
}: {
  actions: ReactNode;
  isCompact: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!actions) {
    return null;
  }

  if (isCompact) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="작업 메뉴 열기"
          title="페이지 작업"
          onClick={() => setIsOpen(true)}
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Button>
        <SheetContent side="right" className="w-80 max-w-[85vw] gap-0 p-0">
          <SheetHeader className="border-b border-border p-4 text-left">
            <SheetTitle>페이지 작업</SheetTitle>
            <SheetDescription>현재 화면에서 사용할 작업을 선택합니다.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 p-4 [&_button]:w-full [&_button]:justify-start">
            {actions}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return <div className="flex flex-wrap gap-2">{actions}</div>;
}

function useIsCompactHeader() {
  const [isCompact, setIsCompact] = useState(() => matchesCompactHeader());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia(compactHeaderMediaQuery);
    const handleChange = () => setIsCompact(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isCompact;
}

function matchesCompactHeader() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia(compactHeaderMediaQuery).matches;
}

function DesktopSidebar({
  activeHref,
  academyName,
  permissionContext,
  visibleNavigation,
}: {
  activeHref?: string;
  academyName: string;
  permissionContext: PermissionContext;
  visibleNavigation: VisibleNavigationItem[];
}) {
  return (
    <aside className="sticky top-0 hidden h-screen min-w-0 border-r border-border bg-card px-4 py-4 lg:block">
      <SidebarBrand academyName={academyName} />
      <SidebarNavigation
        activeHref={activeHref}
        ariaLabel="주요 메뉴"
        permissionContext={permissionContext}
        visibleNavigation={visibleNavigation}
      />
    </aside>
  );
}

function MobileNavigationDrawer({
  activeHref,
  academyName,
  isOpen,
  permissionContext,
  setIsOpen,
  visibleNavigation,
}: {
  activeHref?: string;
  academyName: string;
  isOpen: boolean;
  permissionContext: PermissionContext;
  setIsOpen: (isOpen: boolean) => void;
  visibleNavigation: VisibleNavigationItem[];
}) {
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="mt-1 flex-none lg:hidden"
        aria-label="메뉴 열기"
        onClick={() => setIsOpen(true)}
      >
        <Menu aria-hidden="true" className="size-4" />
      </Button>
      <SheetContent side="left" className="w-80 max-w-[85vw] gap-0 p-0">
        <SheetHeader className="border-b border-border p-4 text-left">
          <SheetTitle>주요 메뉴</SheetTitle>
          <SheetDescription>현재 학원: {academyName}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SidebarNavigation
            activeHref={activeHref}
            ariaLabel="모바일 주요 메뉴"
            permissionContext={permissionContext}
            visibleNavigation={visibleNavigation}
            onNavigate={() => setIsOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SidebarBrand({ academyName }: { academyName: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-muted-foreground">
        Service Console
      </p>
      <h2 className="text-lg font-semibold">학원 운영</h2>
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        현재 학원: {academyName}
      </p>
    </div>
  );
}

function SidebarNavigation({
  activeHref,
  ariaLabel,
  onNavigate,
  permissionContext,
  visibleNavigation,
}: {
  activeHref?: string;
  ariaLabel: string;
  onNavigate?: () => void;
  permissionContext: PermissionContext;
  visibleNavigation: VisibleNavigationItem[];
}) {
  return (
    <nav aria-label={ariaLabel} className="grid gap-1">
      {visibleNavigation.map((item) => (
        <NavigationEntry
          key={item.href}
          item={item}
          activeHref={activeHref}
          onNavigate={onNavigate}
        />
      ))}
      {permissionContext.role === "teacher" ? (
        <Link
          href="/my/payroll"
          onClick={onNavigate}
          className="group flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:min-h-11 lg:gap-3"
        >
          <ReceiptText aria-hidden="true" className="size-4" />
          <span>내 급여</span>
        </Link>
      ) : null}
    </nav>
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

function getActiveRoute(items: VisibleNavigationItem[], pathname: string) {
  for (const item of items) {
    const activeChild = item.children?.find((child) =>
      isActivePath(pathname, child.href),
    );

    if (activeChild) {
      return {
        parent: item,
        item: activeChild,
      };
    }

    if (isActivePath(pathname, item.href)) {
      return {
        parent: item.children?.length ? item : null,
        item,
      };
    }
  }

  return {
    parent: null,
    item: null,
  };
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationEntry({
  item,
  activeHref,
  onNavigate,
}: {
  item: VisibleNavigationItem;
  activeHref?: string;
  onNavigate?: () => void;
}) {
  if (item.children?.length) {
    return (
      <CollapsibleNavigationGroup
        item={item}
        activeHref={activeHref}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <NavigationLink
      item={item}
      isActive={activeHref === item.href}
      onNavigate={onNavigate}
    />
  );
}

function CollapsibleNavigationGroup({
  item,
  activeHref,
  onNavigate,
}: {
  item: VisibleNavigationItem;
  activeHref?: string;
  onNavigate?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isActive = item.href === activeHref || item.children?.some(
    (child) => child.href === activeHref,
  );

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <NavigationLink
          item={item}
          isActive={isActive}
          onNavigate={onNavigate}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 flex-none"
          aria-expanded={isOpen}
          aria-label={`${item.label} 하위 메뉴 ${isOpen ? "접기" : "펼치기"}`}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? (
            <ChevronDown aria-hidden="true" className="size-4" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
      {isOpen ? (
        <div className="grid gap-1 pl-5">
          {item.children?.map((child) => (
            <NavigationLink
              key={child.href}
              item={child}
              isActive={activeHref === child.href}
              onNavigate={onNavigate}
              variant="child"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavigationLink({
  item,
  isActive = false,
  onNavigate,
  variant = "default",
}: {
  item: NavigationItem;
  isActive?: boolean;
  onNavigate?: () => void;
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
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={`group flex w-full items-center gap-2 rounded-md font-medium transition-colors hover:bg-accent hover:text-accent-foreground lg:gap-3 ${sizeClass} ${
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span>{item.label}</span>
    </Link>
  );
}

function HeaderSubNavigation({
  label,
  items,
  activeHref,
}: {
  label: string;
  items: VisibleNavigationItem[];
  activeHref?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="mt-4 flex gap-1 overflow-x-auto pb-1"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={activeHref === item.href ? "page" : undefined}
          className={`flex min-h-9 flex-none items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
            activeHref === item.href
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
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
