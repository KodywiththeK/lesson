"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ShieldAlert } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNavigationDrawer } from "@/components/layout/mobile-navigation-drawer";
import type { VisibleNavigationItem } from "@/components/layout/navigation-types";
import { PageHeaderActionsContext } from "@/components/layout/page-actions";
import { Button } from "@/components/ui/button";
import { mainNavigation, type NavigationItem } from "@/domain/navigation";
import { type PermissionContext, canAccessFeature } from "@/domain/permissions";

type AppShellProps = {
  academyName: string;
  permissionContext: PermissionContext;
  pageTitle?: string;
  children?: ReactNode;
};

const compactHeaderMediaQuery = "(max-width: 767px)";

export function AppShell({
  academyName,
  permissionContext,
  pageTitle = "음악학원 관리",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
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
        <div className="mx-auto grid min-h-screen w-full max-w-[90rem] grid-cols-1 gap-4 p-3 lg:grid-cols-[16rem_minmax(0,1fr)] lg:p-4">
          <AppSidebar
            activeHref={activeRoute.item?.href}
            academyName={academyName}
            visibleNavigation={visibleNavigation}
          />

          <section className="flex min-w-0 flex-col gap-4">
            <AppHeader
              title={headerTitle}
              tabs={headerTabs}
              activeHref={activeRoute.item?.href}
              actions={headerActions}
              isCompact={isCompactHeader}
              academyName={academyName}
              role={permissionContext.role}
              leading={
                <MobileNavigationDrawer
                  activeHref={activeRoute.item?.href}
                  academyName={academyName}
                  visibleNavigation={visibleNavigation}
                />
              }
            />

            <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
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

function AccessDeniedNotice() {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 shadow-card"
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
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md"
          >
            <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-accent text-accent-foreground">
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
