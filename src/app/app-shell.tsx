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
  ChevronDown,
  ChevronRight,
  Menu,
  MoreHorizontal,
  ShieldAlert,
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
import { type PermissionContext, canAccessFeature } from "@/domain/permissions";

type AppShellProps = {
  academyName: string;
  permissionContext: PermissionContext;
  pageTitle?: string;
  children?: ReactNode;
};

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
  const isAccessDenied = isForbiddenRoute(pathname, permissionContext);

  return (
    <PageHeaderActionsContext.Provider value={headerActionsContextValue}>
      <main className="min-h-screen bg-background">
        <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[16rem_1fr]">
          <DesktopSidebar
            activeHref={activeRoute.item?.href}
            academyName={academyName}
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
              {isAccessDenied ? (
                <AccessDeniedNotice />
              ) : (
                (children ?? <DashboardContent visibleNavigation={visibleNavigation} />)
              )}
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
      <>
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
            <div
              className="grid gap-2 p-4 [&_button]:w-full [&_button]:justify-start"
              onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest("button")) setIsOpen(false);
              }}
            >
              {actions}
            </div>
          </SheetContent>
        </Sheet>
        {/* 시트를 닫아도 액션이 소유한 Dialog는 계속 렌더한다. */}
        {!isOpen ? <div className="hidden">{actions}</div> : null}
      </>
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
  visibleNavigation,
}: {
  activeHref?: string;
  academyName: string;
  visibleNavigation: VisibleNavigationItem[];
}) {
  return (
    <aside className="sticky top-0 hidden h-screen min-w-0 border-r border-border bg-card px-4 py-4 lg:block">
      <SidebarBrand academyName={academyName} />
      <SidebarNavigation
        activeHref={activeHref}
        ariaLabel="주요 메뉴"
        visibleNavigation={visibleNavigation}
      />
    </aside>
  );
}

function MobileNavigationDrawer({
  activeHref,
  academyName,
  isOpen,
  setIsOpen,
  visibleNavigation,
}: {
  activeHref?: string;
  academyName: string;
  isOpen: boolean;
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
  visibleNavigation,
}: {
  activeHref?: string;
  ariaLabel: string;
  onNavigate?: () => void;
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

/**
 * 메뉴에 있는 주소인데 현재 역할에게 숨겨진 메뉴면 접근 불가로 본다.
 * 화면 안내용이며 보안 경계가 아니다. 실제 보호는 서버(RLS)가 한다.
 */
function isForbiddenRoute(pathname: string, permissionContext: PermissionContext) {
  const matched = findRouteItem(mainNavigation, pathname);

  return matched !== undefined && !isNavigationItemVisible(matched, permissionContext);
}

function findRouteItem(items: NavigationItem[], pathname: string): NavigationItem | undefined {
  for (const item of items) {
    const child = findBestMatch(item.children, pathname);
    if (child) {
      return child;
    }
    if (item.href !== "/" && isActivePath(pathname, item.href)) {
      return item;
    }
  }

  return undefined;
}

function getActiveRoute(items: VisibleNavigationItem[], pathname: string) {
  for (const item of items) {
    const activeChild = findBestMatch(item.children, pathname);

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

/**
 * 주소와 맞는 메뉴가 여럿이면(`/books`와 `/books/shipments`처럼 한쪽이 다른 쪽의 앞부분) 가장 긴 주소를 고른다.
 * 첫 번째로 맞는 메뉴를 고르면 하위 주소에서도 상위(첫) 탭만 선택되어 보인다.
 */
function findBestMatch<TItem extends { href: string }>(
  items: TItem[] | undefined,
  pathname: string,
): TItem | undefined {
  return items
    ?.filter((item) => isActivePath(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];
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

function AccessDeniedNotice() {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6"
    >
      <ShieldAlert aria-hidden="true" className="size-6 text-muted-foreground" />
      <div>
        <h2 className="text-base font-semibold">이 화면을 볼 권한이 없습니다</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          필요한 경우 원장에게 문의해 주세요.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">홈으로 돌아가기</Link>
      </Button>
    </div>
  );
}

function DashboardContent({
  visibleNavigation,
}: {
  visibleNavigation: VisibleNavigationItem[];
}) {
  const shortcuts = visibleNavigation.filter((item) => item.href !== "/");

  return (
    <section aria-label="바로가기" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {shortcuts.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="flex size-9 flex-none items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}
