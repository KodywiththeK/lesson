import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 알림함 바로가기. 안 읽은 알림이 있으면 점을 찍고 접근 이름에도 알린다. */
export function NotificationBell({ hasUnread }: { hasUnread: boolean }) {
  const label = hasUnread ? "알림함, 읽지 않은 알림 있음" : "알림함";

  return (
    <Button asChild variant="outline" size="icon-sm" className="relative">
      <Link href="/me/inbox" aria-label={label} title={label}>
        <Bell aria-hidden="true" />
        {hasUnread ? (
          <span aria-hidden="true" className="absolute top-1 right-1 size-2 rounded-full bg-destructive" />
        ) : null}
      </Link>
    </Button>
  );
}
