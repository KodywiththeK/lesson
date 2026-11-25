import type { VisibleNavigationItem } from "@/components/layout/navigation-types";
import { mainNavigation, type NavigationItem } from "@/domain/navigation";
import { type PermissionContext, canAccessFeature } from "@/domain/permissions";

/** 역할이 볼 수 있는 메뉴. 사이드바·대시보드 바로가기가 같이 쓴다. */
export function getVisibleNavigation(
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

export function isNavigationItemVisible(
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
