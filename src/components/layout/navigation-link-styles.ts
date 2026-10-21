import { cn } from "@/lib/utils";

type NavigationLinkVariant = "default" | "child" | "tab";

const baseClassName =
  "flex items-center font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30";

const variantClassNames: Record<NavigationLinkVariant, string> = {
  default: "min-h-10 w-full gap-3 rounded-xl px-3 text-sm lg:min-h-11",
  child: "min-h-9 w-full gap-2 rounded-lg px-3 text-xs",
  tab: "min-h-9 flex-none rounded-full px-4 text-sm",
};

/** 사이드바 메뉴와 헤더 하위 탭이 같은 활성·비활성 색을 쓰도록 한 곳에서 정의한다. */
export function navigationLinkClassName(
  variant: NavigationLinkVariant,
  isActive: boolean,
  hasActiveChild = false,
) {
  if (hasActiveChild) {
    // 하위 메뉴가 활성이면 상위는 글자색만 강조해 알약이 겹쳐 무거워지지 않게 한다.
    return cn(
      baseClassName,
      variantClassNames[variant],
      "font-semibold text-primary hover:bg-muted",
    );
  }

  return cn(
    baseClassName,
    variantClassNames[variant],
    isActive
      ? "bg-accent font-semibold text-accent-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}
