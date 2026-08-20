# 요구사항 추적 매트릭스

PDF 요구사항, 사용자 추가 지시, 테스트, 구현 위치를 연결한다. 구현 중 새 테스트나 파일이 생기면 이 문서를 함께 갱신한다.

| 요구사항 | 출처 | 인수 시나리오 | 테스트 | 구현 |
| --- | --- | --- | --- | --- |
| 출석 확인 시에만 회차권을 1회 차감한다 | PDF Part 2 전역 규칙 | 회차권 차감 | `src/domain/lesson-ticket.test.ts` | `src/domain/lesson-ticket.ts` |
| 결석은 회차권을 차감하지 않는다 | PDF Part 2 전역 규칙 | 회차권 차감 | `src/domain/lesson-ticket.test.ts` | `src/domain/lesson-ticket.ts` |
| 수업 일정에 올라간 상태만으로는 회차권을 차감하지 않는다 | PDF Part 2 전역 규칙 | 회차권 차감 | `src/domain/lesson-ticket.test.ts` | `src/domain/lesson-ticket.ts` |
| 다른 학원 tenant의 회차권은 차감하지 못한다 | 사용자 추가 지시: 멀티학원 서비스 | 멀티테넌트 데이터 격리 | `src/domain/lesson-ticket.test.ts` | `src/domain/lesson-ticket.ts` |
| API cache key는 학원별로 분리한다 | 사용자 추가 지시: TanStack Query + 멀티학원 서비스 | API cache 격리 | `src/lib/api/query-keys.test.ts` | `src/lib/api/query-keys.ts` |
| 학원 피아노 수업 일정은 원생 등록 정보에서 반복 생성된다 | PDF 1-1 | 학원 피아노 레슨표 | `src/domain/academy-lesson-schedule.test.ts` | `src/domain/academy-lesson-schedule.ts` |
| 학원 수업 일정 이동은 해당 월에만 반영된다 | PDF 1-1 | 학원 피아노 레슨표 | `src/domain/academy-lesson-schedule.test.ts` | `src/domain/academy-lesson-schedule.ts` |
| 결석 확인은 보강 일정 또는 패스 기록을 만들 수 있다 | PDF 1-1 시나리오 B | 학원 수업 보강 | `src/domain/academy-lesson-absence.test.ts` | `src/domain/academy-lesson-absence.ts` |
| 보강 확정은 `[보강 수업]` 일정과 월별 메모를 만든다 | PDF 1-1 시나리오 B | 학원 수업 보강 | `src/domain/academy-lesson-absence.test.ts` | `src/domain/academy-lesson-absence.ts` |
| 패스 확정은 보강 일정 없이 메모만 만들고 회차권을 차감하지 않는다 | PDF 1-1 시나리오 B | 학원 수업 보강 | `src/domain/academy-lesson-absence.test.ts` | `src/domain/academy-lesson-absence.ts` |
| 개인레슨 등록은 같은 선생님/시간 중복을 막는다 | PDF 1-2 | 개인레슨 등록 | `src/domain/private-lesson.test.ts` | `src/domain/private-lesson.ts` |
| 개인레슨 악기 선택은 원생이 수강 중인 개인레슨 악기로 제한한다 | PDF 1-2 | 개인레슨 등록 | `src/domain/private-lesson.test.ts` | `src/domain/private-lesson.ts` |
| 원생 시간표는 메시지 텍스트로 복사할 수 있다 | PDF 1-2 | 시간표 복사 | `src/domain/private-lesson.test.ts` | `src/domain/private-lesson.ts` |
| 선생님 시간표는 메시지 텍스트로 복사할 수 있다 | PDF 1-2 | 시간표 복사 | `src/domain/private-lesson.test.ts` | `src/domain/private-lesson.ts` |
| 회차권 재등록은 회수 추가와 유효기간 갱신을 지원한다 | PDF 2 | 회차권 재등록과 상태 표시 | `src/domain/lesson-ticket.test.ts` | `src/domain/lesson-ticket.ts` |
| 회차권 잔여 회수 부족 또는 만료 임박 상태를 표시한다 | PDF 2 | 회차권 재등록과 상태 표시 | `src/domain/lesson-ticket.test.ts` | `src/domain/lesson-ticket.ts` |
| 원생 등록은 일정과 고정 수입의 기준이 된다 | PDF 3-1 | 원생 등록 | `src/domain/student-registration.test.ts` | `src/domain/student-registration.ts` |
| 휴원/퇴원 전환은 확인 절차를 가진다 | PDF 3-3 | 원생 상태 전환 | `src/domain/student-status.test.ts` | `src/domain/student-status.ts` |
| 퇴원 원생은 30일 보관 후 삭제된다 | PDF 3-3 | 원생 보관 정책 | `src/domain/student-status.test.ts` | `src/domain/student-status.ts` |
| 교재 결제 완료는 수입 ledger에 반영된다 | PDF 4 | 교재 판매 | 미작성 | 미구현 |
| 월별 고정 수입 수납/미납은 월 단위 snapshot으로 관리된다 | PDF 5 | 수입 관리 | 미작성 | 미구현 |
| 급여 지급은 지출 내역을 생성한다 | PDF 5 | 급여 지급 | 미작성 | 미구현 |
| 비율제 급여는 3.3% 원천징수를 반영한다 | PDF 5 | 급여 지급 | 미작성 | 미구현 |
