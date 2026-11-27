import Link from "next/link";

import { siteName } from "@/app/seo";
import { appVersion, serviceOperator } from "@/app/service-info";
import { cn } from "@/lib/utils";

const linkClassName = "underline-offset-4 hover:text-foreground hover:underline";

/**
 * 로그인 전·후 모든 화면 본문 맨 아래의 푸터. 문의, 약관·개인정보처리방침, 저작권·버전을 둔다.
 * 화면 셸이 `<main>` 안에 있어 `<footer>`만으로는 페이지 푸터 랜드마크가 되지 않으므로 역할을 직접 준다.
 */
export function AppFooter({ className }: { className?: string }) {
  return (
    <footer
      role="contentinfo"
      className={cn("grid gap-1.5 border-t border-border pt-4 pb-2 text-xs text-muted-foreground", className)}>
      <p className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium text-foreground">{siteName}</span>
        <span aria-hidden="true">·</span>
        <span>
          문의{" "}
          <a className={linkClassName} href={`mailto:${serviceOperator.email}`}>
            {serviceOperator.email}
          </a>
        </span>
        <span aria-hidden="true">·</span>
        <a className={linkClassName} href={serviceOperator.openChatUrl} target="_blank" rel="noopener noreferrer">
          카카오톡 오픈채팅
        </a>
      </p>
      <nav aria-label="약관" className="flex flex-wrap gap-x-2">
        <Link className={linkClassName} href="/terms">
          이용약관
        </Link>
        <span aria-hidden="true">·</span>
        <Link className={cn(linkClassName, "font-semibold text-foreground")} href="/privacy">
          개인정보처리방침
        </Link>
      </nav>
      <p>
        © 2026 {siteName} · v{appVersion}
      </p>
    </footer>
  );
}
