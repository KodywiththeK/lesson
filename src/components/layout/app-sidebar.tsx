"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NavigationItem } from "@/domain/navigation";

import { BrandLogo } from "./brand-logo";
import { navigationLinkClassName } from "./navigation-link-styles";
import type { VisibleNavigationItem } from "./navigation-types";

export function AppSidebar({
  activeHref,
  academyName,
  visibleNavigation,
}: {
  activeHref?: string;
  academyName: string;
  visibleNavigation: VisibleNavigationItem[];
}) {
  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:flex">
      <div className="px-5 pt-5 pb-4">
        <SidebarBrand academyName={academyName} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <SidebarNavigation
          activeHref={activeHref}
          ariaLabel="주요 메뉴"
          visibleNavigation={visibleNavigation}
        />
      </div>
    </aside>
  );
}

function SidebarBrand({ academyName }: { academyName: string }) {
  return (
    <div className="grid min-w-0 gap-3">
      <BrandLogo />
      <p className="truncate text-xs font-medium text-muted-foreground">
        현재 학원: {academyName}
      </p>
    </div>
  );
}

export function SidebarNavigation({
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
  const hasActiveChild = item.children?.some(
    (child) => child.href === activeHref,
  );
  const isActive = item.href === activeHref || hasActiveChild;

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <NavigationLink
          item={item}
          isActive={isActive}
          hasActiveChild={hasActiveChild}
          onNavigate={onNavigate}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 flex-none rounded-lg text-muted-foreground"
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
        <div className="ml-5 grid gap-1 border-l border-border pl-2">
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
  hasActiveChild = false,
  onNavigate,
  variant = "default",
}: {
  item: NavigationItem;
  isActive?: boolean;
  hasActiveChild?: boolean;
  onNavigate?: () => void;
  variant?: "default" | "child";
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={navigationLinkClassName(variant, isActive, hasActiveChild)}
    >
      <Icon
        aria-hidden="true"
        className={isActive ? "size-4 text-primary" : "size-4"}
      />
      <span>{item.label}</span>
    </Link>
  );
}
