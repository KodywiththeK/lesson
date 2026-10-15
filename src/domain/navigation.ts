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
    href: "/finance/ledger",
    description: "입출금, 레슨수입, 교재, 급여, 전체수입을 확인합니다.",
    icon: Banknote,
    children: [
      {
        label: "입출금 내역",
        href: "/finance/ledger",
        description: "학원 사업자 통장 입출금 내역을 관리합니다.",
        icon: Banknote,
        feature: "income-management",
      },
      {
        label: "학원 레슨수입",
        href: "/finance/lesson-income",
        description: "학원레슨 월수강료와 개인레슨 회차권 수입을 관리합니다.",
        icon: Banknote,
        feature: "income-management",
      },
      {
        label: "교재내역",
        href: "/finance/books",
        description: "교재 발주, 출고, 입금 내역을 확인합니다.",
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
        label: "전체수입",
        href: "/finance/overview",
        description: "월별, 분류별 수입 그래프와 합계를 확인합니다.",
        icon: Banknote,
        feature: "income-management",
      },
    ],
  },
];
