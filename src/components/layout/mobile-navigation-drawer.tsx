"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { SidebarNavigation } from "./app-sidebar";
import { BrandLogo } from "./brand-logo";
import type { VisibleNavigationItem } from "./navigation-types";
import {
  NAVIGATION_SCROLL_STORAGE_KEYS,
  PersistentNavigationScrollArea,
} from "./persistent-navigation-scroll-area";

export function MobileNavigationDrawer({
  activeHref,
  academyName,
  visibleNavigation,
}: {
  activeHref?: string;
  academyName: string;
  visibleNavigation: VisibleNavigationItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="flex-none lg:hidden"
        aria-label="메뉴 열기"
        onClick={() => setIsOpen(true)}
      >
        <Menu aria-hidden="true" className="size-4" />
      </Button>
      <SheetContent
        side="left"
        className="w-80 max-w-[85vw] gap-0 rounded-r-2xl p-0"
      >
        <SheetHeader className="border-b border-border p-4 text-left">
          <BrandLogo className="mb-2 w-36" />
          <SheetTitle>주요 메뉴</SheetTitle>
          <SheetDescription>현재 학원: {academyName}</SheetDescription>
        </SheetHeader>
        <PersistentNavigationScrollArea
          ariaLabel="모바일 메뉴 스크롤"
          className="min-h-0 flex-1 overflow-y-auto p-3"
          restoreSignal={isOpen}
          storageKey={NAVIGATION_SCROLL_STORAGE_KEYS.mobile}
        >
          <SidebarNavigation
            activeHref={activeHref}
            ariaLabel="모바일 주요 메뉴"
            visibleNavigation={visibleNavigation}
            onNavigate={() => setIsOpen(false)}
          />
        </PersistentNavigationScrollArea>
      </SheetContent>
    </Sheet>
  );
}
