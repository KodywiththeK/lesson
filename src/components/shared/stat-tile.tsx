import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SectionCard } from "./section-card";

/** 작은 라벨 아래에 큰 숫자를 놓는 요약 값. 카드 없이도 쓸 수 있게 분리했다. */
export function StatFigure({
  label,
  children,
  emphasized = true,
  className,
}: {
  label: string;
  /** 보여 줄 값. 아직 없으면 호출한 쪽이 "-" 같은 대체 표시를 넘긴다. */
  children: ReactNode;
  /** 합계처럼 한 화면의 중심 값이면 켠다(기본). 보조 값이면 끈다. */
  emphasized?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-semibold", emphasized ? "text-2xl" : "text-xl")}>
        {children}
      </p>
    </div>
  );
}

/** 요약 값을 카드로 감싼 타일. 접근 가능한 묶음이 필요하면 `role="group" aria-label`을 넘긴다. */
export function StatTile({
  label,
  children,
  emphasized,
  ...cardProps
}: Omit<ComponentProps<typeof SectionCard>, "children"> &
  Pick<ComponentProps<typeof StatFigure>, "label" | "children" | "emphasized">) {
  return (
    <SectionCard {...cardProps}>
      <StatFigure label={label} emphasized={emphasized}>
        {children}
      </StatFigure>
    </SectionCard>
  );
}
