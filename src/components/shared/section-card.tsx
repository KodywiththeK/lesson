import type { ComponentProps, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * 화면의 한 구획을 담는 흰 카드. shadcn `Card`의 기본 여백(`py-6 gap-6`)을 걷어 내고
 * 안쪽 구성(필드 묶음, 표, 요약)을 호출한 쪽이 정하게 한다.
 * 표처럼 가장자리까지 닿아야 하면 `padded={false}`로 쓴다(모서리는 카드가 잘라 준다).
 */
export function SectionCard({
  className,
  padded = true,
  ...props
}: ComponentProps<"div"> & { padded?: boolean }) {
  return (
    <Card
      className={cn("gap-0 py-0", padded ? "p-4" : "overflow-hidden", className)}
      {...props}
    />
  );
}

type SectionHeaderProps = {
  title: string;
  description?: string;
  /** 제목 옆(좁은 화면에서는 아래)에 두는 작업 버튼들. */
  actions?: ReactNode;
  /** 카드 안쪽 소제목처럼 제목 단계를 낮춰야 할 때 쓴다. 단계가 낮으면 글자도 한 단계 작다. */
  as?: "h2" | "h3";
  /** 구획이 `aria-labelledby`로 이 제목을 이름으로 쓸 때 연결할 id. */
  headingId?: string;
};

const headingClassNames = {
  h2: "text-lg font-semibold",
  h3: "text-base font-semibold",
};

export function SectionHeader({
  title,
  description,
  actions,
  as: Heading = "h2",
  headingId,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="grid gap-1">
        <Heading id={headingId} className={headingClassNames[Heading]}>
          {title}
        </Heading>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
