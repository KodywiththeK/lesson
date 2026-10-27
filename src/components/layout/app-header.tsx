"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SessionRole } from "@/domain/permissions";
import { academyRoleLabels } from "@/domain/auth-onboarding";
import { useAcademySessionControls } from "@/features/auth/academy-session-gate";

import { navigationLinkClassName } from "./navigation-link-styles";
import type { VisibleNavigationItem } from "./navigation-types";

const roleLabels: Record<SessionRole, string> = {
  ...academyRoleLabels,
  anonymous: "게스트",
};

export function AppHeader({
  title,
  tabs,
  activeHref,
  actions,
  isCompact,
  academyName,
  role,
  leading,
}: {
  title: string;
  tabs: VisibleNavigationItem[];
  activeHref?: string;
  actions: ReactNode;
  isCompact: boolean;
  academyName: string;
  role: SessionRole;
  leading?: ReactNode;
}) {
  return (
    <header className="sticky top-3 z-40 rounded-2xl border border-border bg-card/95 px-4 py-4 shadow-card backdrop-blur supports-[backdrop-filter]:bg-card/85 md:px-6 lg:top-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <h1 className="min-w-0 text-xl font-semibold md:text-2xl">{title}</h1>
        </div>
        <div className="flex flex-none items-center gap-3">
          <HeaderActions actions={actions} isCompact={isCompact} />
          <HeaderUser academyName={academyName} role={role} />
        </div>
      </div>
      {tabs.length > 0 ? (
        <HeaderSubNavigation
          label={`${title} 하위 메뉴`}
          activeHref={activeHref}
          items={tabs}
        />
      ) : null}
    </header>
  );
}

function HeaderUser({
  academyName,
  role,
}: {
  academyName: string;
  role: SessionRole;
}) {
  const description = `${academyName} · ${roleLabels[role]}`;
  const session = useAcademySessionControls();

  return (
    <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-3">
      <span
        aria-hidden="true"
        title={description}
        className="flex size-10 flex-none items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
      >
        {academyName.trim().charAt(0)}
      </span>
      <p className="hidden max-w-48 truncate text-sm font-medium sm:block">
        {description}
      </p>
      {session ? <DropdownMenu>
        <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" aria-label="계정과 학원 메뉴">학원 전환</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {session.academies.map((academy) => <DropdownMenuItem key={academy.academyId} onSelect={() => session.selectAcademy(academy.academyId)}>{academy.academyName} · {roleLabels[academy.role]}</DropdownMenuItem>)}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/onboarding">다른 학원 만들기·가입 신청</Link></DropdownMenuItem>
          {role === "owner" && process.env.NEXT_PUBLIC_LEGACY_OWNER_LINK_ENABLED === "1" ?
            <DropdownMenuItem asChild><Link href="/auth/retire-email">기존 이메일 로그인 정리</Link></DropdownMenuItem> : null}
          <DropdownMenuItem onSelect={() => void session.signOut()}>로그아웃</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu> : null}
    </div>
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
          <SheetContent
            side="right"
            className="w-80 max-w-[85vw] gap-0 rounded-l-2xl p-0"
          >
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

  return <div className="flex flex-wrap justify-end gap-2">{actions}</div>;
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
      className="mt-4 flex gap-1 overflow-x-auto border-t border-border pt-3"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={activeHref === item.href ? "page" : undefined}
          className={navigationLinkClassName("tab", activeHref === item.href)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
