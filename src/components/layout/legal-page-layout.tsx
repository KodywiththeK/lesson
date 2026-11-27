import Link from "next/link";
import type { ReactNode } from "react";

import { legalEffectiveDate } from "@/app/service-info";

import { AppFooter } from "./app-footer";
import { BrandLogo } from "./brand-logo";

/** 이용약관·개인정보처리방침처럼 로그인 없이 읽는 문서 화면. */
export function LegalPageLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <Link href="/" className="w-fit" aria-label="마디마디 홈">
          <BrandLogo className="w-32" />
        </Link>
        <article className="grid gap-6 rounded-xl border border-border bg-card p-5 shadow-card sm:p-8">
          <header className="grid gap-1">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">시행일: {legalEffectiveDate}</p>
          </header>
          <div className="grid gap-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_section]:grid [&_section]:gap-2">
            {children}
          </div>
        </article>
        <AppFooter />
      </div>
    </main>
  );
}
