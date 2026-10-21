import type { NavigationItem } from "@/domain/navigation";

export type VisibleNavigationItem = NavigationItem & {
  children?: VisibleNavigationItem[];
};
