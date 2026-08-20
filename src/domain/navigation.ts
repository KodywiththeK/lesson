import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BookOpen,
  CalendarDays,
  Gauge,
  GraduationCap,
  Handshake,
  ScrollText,
  UsersRound,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export const mainNavigation: NavigationItem[] = [
  {
    label: "대시보드",
    href: "/",
    description: "오늘 운영 상태와 미처리 항목을 확인합니다.",
    icon: Gauge,
  },
  {
    label: "레슨 시간표",
    href: "/lessons",
    description: "학원 피아노 레슨표와 개인레슨 일정을 관리합니다.",
    icon: CalendarDays,
  },
  {
    label: "회차권",
    href: "/passes",
    description: "회차권 등록, 추가, 차감, 만료 임박 상태를 관리합니다.",
    icon: ScrollText,
  },
  {
    label: "원생",
    href: "/students",
    description: "원생 기본정보와 악기별 수강 설정을 관리합니다.",
    icon: UsersRound,
  },
  {
    label: "선생님",
    href: "/teachers",
    description: "선생님 프로필, 담당 파트, 급여 기준을 관리합니다.",
    icon: GraduationCap,
  },
  {
    label: "거래처",
    href: "/vendors",
    description: "교재, 조율, 운영 거래처 정보를 관리합니다.",
    icon: Handshake,
  },
  {
    label: "교재",
    href: "/books",
    description: "교재 재고, 출고, 결제 완료 상태를 관리합니다.",
    icon: BookOpen,
  },
  {
    label: "수입",
    href: "/finance",
    description: "수강료, 교재, 급여, 입출입 내역을 확인합니다.",
    icon: Banknote,
  },
];
