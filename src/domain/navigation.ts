import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Banknote,
  BookOpen,
  CalendarDays,
  Gauge,
  GraduationCap,
  Handshake,
  ScrollText,
  UsersRound,
} from "lucide-react";

import type { FeatureKey } from "./permissions";

export type NavigationItem = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  children?: NavigationItem[];
};

export const mainNavigation: NavigationItem[] = [
  {
    label: "대시보드",
    href: "/",
    description: "자주 쓰는 메뉴로 바로 이동합니다.",
    icon: Gauge,
  },
  {
    label: "레슨 시간표",
    href: "/lessons/academy",
    description: "학원 피아노 레슨표와 개인레슨 일정을 관리합니다.",
    icon: CalendarDays,
    children: [
      {
        label: "학원레슨표",
        href: "/lessons/academy",
        description: "학원 피아노 정기/비정기 레슨표를 관리합니다.",
        icon: CalendarDays,
        feature: "lesson-schedule",
      },
      {
        label: "개인레슨표",
        href: "/lessons/private",
        description: "개인레슨 일정과 출석을 관리합니다.",
        icon: CalendarDays,
        feature: "lesson-schedule",
      },
    ],
  },
  {
    label: "회차권",
    href: "/passes",
    description: "회차권 등록, 추가, 수정, 차감, 잔여 부족 상태를 관리합니다.",
    icon: ScrollText,
    feature: "tickets",
  },
  {
    label: "인원·거래처",
    href: "/management/students",
    description: "원생, 선생님, 휴원/퇴원, 거래처를 한 영역에서 관리합니다.",
    icon: UsersRound,
    children: [
      {
        label: "원생",
        href: "/management/students",
        description: "원생 기본정보와 악기별 수강 설정을 관리합니다.",
        icon: UsersRound,
        feature: "students",
      },
      {
        label: "선생님",
        href: "/management/teachers",
        description: "선생님 프로필, 담당 파트, 급여 기준을 관리합니다.",
        icon: GraduationCap,
        feature: "teachers",
      },
      {
        label: "휴원/퇴원",
        href: "/management/status",
        description: "휴원, 퇴원, 휴직, 퇴사 대상을 분리해 관리합니다.",
        icon: Archive,
        feature: "status-management",
      },
      {
        label: "거래처",
        href: "/management/vendors",
        description: "교재, 조율, 운영 거래처 정보를 관리합니다.",
        icon: Handshake,
        feature: "vendors",
      },
    ],
  },
  {
    label: "교재",
    href: "/books",
    description: "교재 재고, 출고, 결제 완료 상태를 관리합니다.",
    icon: BookOpen,
    feature: "books",
  },
  {
    label: "수입 관리",
    href: "/finance/lesson-income",
    description: "학원 고정 수입, 입출입내역, 교재 내역, 선생님 월급, 전체 수입을 확인합니다.",
    icon: Banknote,
    children: [
      {
        label: "학원 고정 수입",
        href: "/finance/lesson-income",
        description: "원생별 월 수강료와 입금·미납 상태를 관리합니다.",
        icon: Banknote,
        feature: "income-management",
      },
      {
        label: "입출입내역",
        href: "/finance/ledger",
        description: "학원 사업자 통장의 월별 입금·출금 내역을 관리합니다.",
        icon: Banknote,
        feature: "income-management",
      },
      {
        label: "교재 내역",
        href: "/finance/books",
        description: "결제 완료된 교재 판매 내역과 합계를 확인합니다.",
        icon: BookOpen,
        feature: "income-management",
      },
      {
        label: "선생님 월급",
        href: "/finance/payroll",
        description: "월별 선생님 급여 계산과 지급을 관리합니다.",
        icon: Banknote,
        feature: "income-management",
      },
      {
        label: "전체 수입",
        href: "/finance/overview",
        description: "연도별 수입·지출·순수익과 수납·미납 현황, 그래프를 확인합니다.",
        icon: Banknote,
        feature: "income-management",
      },
    ],
  },
];
