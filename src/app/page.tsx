import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  ReceiptText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { mainNavigation } from "@/domain/navigation";

const workQueue = [
  {
    label: "오늘 출석 확인",
    value: "12건",
    tone: "bg-accent text-accent-foreground",
    icon: ClipboardCheck,
  },
  {
    label: "회차권 임박",
    value: "5명",
    tone: "bg-secondary text-secondary-foreground",
    icon: CalendarCheck,
  },
  {
    label: "미납 확인",
    value: "3건",
    tone: "bg-destructive/10 text-destructive",
    icon: AlertCircle,
  },
];

const nextMilestones = [
  "회차권 차감 순수 로직",
  "역할별 권한 골격",
  "원생/선생님 관리",
  "개인레슨표와 출석 확인",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[16rem_1fr]">
        <aside className="border-b border-border bg-card px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground">
              Service Console
            </p>
            <h2 className="text-lg font-semibold">학원 운영</h2>
          </div>
          <nav aria-label="주요 메뉴" className="grid gap-1">
            {mainNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="border-b border-border px-5 py-5 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  현재 학원: 더 클래식
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl">
                  음악학원 관리
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">
                  <ReceiptText aria-hidden="true" />
                  수납 등록
                </Button>
                <Button>
                  <ClipboardCheck aria-hidden="true" />
                  출석 확인
                </Button>
              </div>
            </div>
          </header>

          <div className="grid gap-6 px-5 py-6 md:px-8">
            <section
              aria-label="운영 대기열"
              className="grid gap-3 md:grid-cols-3"
            >
              {workQueue.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.label}
                    className="rounded-lg border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`flex size-9 items-center justify-center rounded-md ${item.tone}`}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <p className="text-2xl font-semibold">{item.value}</p>
                    </div>
                    <h3 className="mt-4 text-sm font-medium">{item.label}</h3>
                  </article>
                );
              })}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border p-4">
                  <h2 className="text-base font-semibold">우선 개발 흐름</h2>
                </div>
                <div className="divide-y divide-border">
                  {nextMilestones.map((milestone, index) => (
                    <div
                      key={milestone}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {index === 0 ? "진행 중" : `${index + 1}단계`}
                        </p>
                        <p className="mt-1 text-sm font-medium">{milestone}</p>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold">핵심 규칙</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  레슨 일정 등록만으로 회차권을 차감하지 않고, 실제 등원 확인
                  시점에만 1회를 차감한다. 결석은 회차를 차감하지 않는다.
                </p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
