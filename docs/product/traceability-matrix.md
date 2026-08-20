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
| 교재 결제 완료는 수입 ledger에 반영된다 | PDF 4 | 교재 판매 | `src/domain/book-sale.test.ts` | `src/domain/book-sale.ts` |
| 월별 고정 수입 수납/미납은 월 단위 snapshot으로 관리된다 | PDF 5 | 수입 관리 | `src/domain/tuition-income.test.ts` | `src/domain/tuition-income.ts` |
| 급여 지급은 지출 내역을 생성한다 | PDF 5 | 급여 지급 | `src/domain/payroll.test.ts` | `src/domain/payroll.ts` |
| 비율제 급여는 3.3% 원천징수를 반영한다 | PDF 5 | 급여 지급 | `src/domain/payroll.test.ts` | `src/domain/payroll.ts` |
| 역할별 로그인은 원장, 데스크 직원, 선생님 역할을 구분한다 | PDF 개요 | 역할별 로그인과 권한 | `src/domain/permissions.test.ts` | `src/domain/permissions.ts` |
| 선생님은 본인 학원과 배정 범위 안에서만 접근한다 | 사용자 추가 지시: 멀티학원 서비스 + PDF 권한 | 역할별 로그인과 권한 | `src/domain/permissions.test.ts` | `src/domain/permissions.ts` |
| 선생님은 거래처 관리에 접근할 수 없다 | PDF 3-4 | 역할별 로그인과 권한 | `src/domain/permissions.test.ts` | `src/domain/permissions.ts` |
| 수입 관리는 기본적으로 원장 전용으로 제한한다 | PDF 5 + 제품 결정 | 역할별 로그인과 권한 | `src/domain/permissions.test.ts` | `src/domain/permissions.ts` |
| 공통 목록은 10개 기본, 10/20/30 페이지 크기, 가나다 정렬을 지원한다 | PDF 목록 공통 | 공통 목록 동작 | `src/domain/common-list.test.ts`, `src/components/operations/list-toolbar.test.tsx` | `src/domain/common-list.ts`, `src/components/operations/list-toolbar.tsx` |
| 원생, 선생님, 거래처, 교재, 수입 내역은 검색 또는 필터를 제공한다 | PDF 목록 공통 | 공통 목록 동작 | `src/domain/common-list.test.ts`, `src/components/operations/list-toolbar.test.tsx` | `src/domain/common-list.ts`, `src/components/operations/list-toolbar.tsx` |
| 날짜 선택 시 해당 날짜의 예상 출석 원생을 보여준다 | PDF 1-1 | 학원 피아노 레슨표 | `src/domain/academy-lesson-attendance.test.ts` | `src/domain/academy-lesson-attendance.ts` |
| 학원 수업 일정 삭제는 사유 입력과 함께 처리한다 | PDF 1-1 | 학원 피아노 레슨표 | `src/domain/academy-lesson-schedule.test.ts` | `src/domain/academy-lesson-schedule.ts` |
| 일별 출석 모달은 원생별 출석/결석, 전체 출석, 전체 결석을 지원한다 | PDF 1-1 | 학원 피아노 레슨표 | `src/domain/academy-lesson-attendance.test.ts` | `src/domain/academy-lesson-attendance.ts` |
| 결석 처리된 원생은 결석 인원 목록으로 이동하고 확정 후 목록에서 제거된다 | PDF 1-1 | 학원 수업 보강 | `src/domain/academy-lesson-attendance.test.ts`, `src/domain/academy-lesson-absence.test.ts` | `src/domain/academy-lesson-attendance.ts`, `src/domain/academy-lesson-absence.ts` |
| 월별 메모는 월별 저장, 읽지 않음 표시, 새로고침 시 위치/크기 초기화 규칙을 가진다 | PDF 1-1 | 월별 메모 | `src/domain/monthly-memo.test.ts` | `src/domain/monthly-memo.ts` |
| 개인레슨 등록 다이얼로그는 원생, 악기, 선생님, 시간 순서로 진행한다 | PDF 1-2 | 개인레슨 등록 UI | `src/domain/private-lesson.test.ts` | `src/domain/private-lesson.ts` |
| 개인레슨 원생 검색 결과는 잔여 회차와 최근 레슨 상태를 함께 표시한다 | PDF 1-2 | 개인레슨 등록 UI | `src/domain/private-lesson.test.ts` | `src/domain/private-lesson.ts` |
| 회차권 수동 수정은 권한 있는 역할만 수행한다 | PDF 2 | 회차권 관리 권한 | `src/domain/lesson-ticket.test.ts`, `src/domain/permissions.test.ts` | `src/domain/lesson-ticket.ts`, `src/domain/permissions.ts` |
| 원생 목록은 이름, 선생님, 악기, 정기 요일 기준 검색/정렬을 지원한다 | PDF 3-1 | 원생 목록 | 미작성 | 미구현 |
| 선생님 등록은 담당 파트, 연락처, 등록일, 주민등록번호, 급여 형태를 기록한다 | PDF 3-2 | 선생님 등록 | 미작성 | 미구현 |
| 거래처 등록은 거래처명, 연락처, 종류, 비고를 기록한다 | PDF 3-4 | 거래처 등록 | 미작성 | 미구현 |
| 교재 구매 목록은 원생, 교재명, 자동 입력 가격, 출고일을 기록한다 | PDF 4 | 교재 판매 UI | 미작성 | 미구현 |
| 원장 또는 허용된 데스크 직원은 수동 수입/지출을 입력할 수 있다 | PDF 5 | 입출입 내역 | 미작성 | 미구현 |
| 전체 수입 그래프는 연도/월 기준 전체 악기, 개별 악기, 학원 수입, 지출 비교를 지원한다 | PDF 5 | 전체 수입 그래프 | 미작성 | 미구현 |
| 월급제와 시급제 급여 유형은 조건부 필드와 계산 기준을 가진다 | PDF 3-2, PDF 5 | 급여 지급 | 미작성 | 미구현 |
| Supabase DB는 학원 tenant별 데이터 격리와 RLS 정책을 가진다 | 사용자 추가 지시: 멀티학원 서비스 | Supabase RLS | `docs/harness/evidence/2026-08-20-supabase-tenant-core-rls.md` | `supabase/migrations/20260820142318_tenant_core_schema.sql` |
| shadcn 기반 운영 UI는 일관된 디자인 시스템으로 구현된다 | 사용자 추가 지시: shadcn 디자인 시스템 | 운영 UI | `src/app/app-shell.test.tsx`, `src/app/page.test.tsx` | `src/app/app-shell.tsx`, `src/app/page.tsx` |
