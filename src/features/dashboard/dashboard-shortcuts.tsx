import Link from "next/link";

import { getVisibleNavigation } from "@/components/layout/visible-navigation";
import type { PermissionContext } from "@/domain/permissions";

/** 대시보드의 메뉴 바로가기. 역할이 볼 수 있는 메뉴만 보여 준다. */
export function DashboardShortcuts({ permissionContext }: { permissionContext: PermissionContext }) {
  const shortcuts = getVisibleNavigation(permissionContext).filter((item) => item.href !== "/");

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
