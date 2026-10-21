import type { ComponentProps } from "react";

import { Empty, EmptyDescription } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * 목록 안의 한 줄 안내 문구. "등록된 …이 없습니다", "…을 불러오는 중입니다"처럼
 * 비어 있거나 기다리는 상태를 같은 모양으로 보여 준다. `role` 같은 접근성 속성은 그대로 전달한다.
 */
export function EmptyState({
  children,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title">) {
  return (
    <Empty className={cn("gap-0 p-6 md:p-8", className)} {...props}>
      <EmptyDescription>{children}</EmptyDescription>
    </Empty>
  );
}
