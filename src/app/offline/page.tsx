import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "연결 확인",
  robots: { index: false, follow: false },
};

/** 서비스 워커가 저장해 두는 유일한 화면. 학생 정보가 담기지 않도록 정적 안내만 둔다. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-card">
        <WifiOff aria-hidden="true" className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">인터넷 연결을 확인해 주세요</h1>
        <p className="text-sm text-muted-foreground">
          연결되면 레슨표와 할 일을 다시 불러옵니다. 저장하지 못한 변경은 연결 뒤 다시 해 주세요.
        </p>
        <Button asChild>
          <Link href="/">다시 시도</Link>
        </Button>
      </section>
    </main>
  );
}
