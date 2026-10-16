import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "./query-keys";

// 원생·선생님 정보가 바뀌면 이 화면들의 캐시도 낡는다(급여 계산, 레슨표, 회차권, 휴원/퇴원 목록).
const PEOPLE_DEPENDENT_SECTIONS = [
  "students",
  "teachers",
  "status-management",
  "lesson-workspace",
  "private-lessons",
  "lesson-tickets",
  "finance",
] as const;

/** 원생·선생님 등록·수정·상태 변경 뒤 함께 갱신해야 하는 쿼리를 한 곳에서 무효화한다. */
export function invalidateAfterPeopleChange(queryClient: QueryClient, academyId: string) {
  for (const section of PEOPLE_DEPENDENT_SECTIONS) {
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.academy(academyId), section] });
  }
}

/** 교재·출고·결제 변경 뒤 함께 갱신해야 하는 쿼리: 교재 탭(재고·출고·결제 완료)과 수입 관리(교재 내역·입출입내역·연간 수입). */
export function invalidateAfterBookChange(queryClient: QueryClient, academyId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.books.all(academyId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(academyId) });
}
