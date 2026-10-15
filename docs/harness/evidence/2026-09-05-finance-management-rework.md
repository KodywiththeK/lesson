# 수입 관리 개편 Evidence

> 이 문서는 당시 구현 상태를 기록한다. 원장 권한, 교재 발주일 표시, 결제 원자성 및 원격 데이터 보정의 최신 상태는 [2026-10-15 연동·품질 검토](./2026-10-15-finance-integration-review.md)를 따른다.

## 요약

- 목표: `수입 관리`를 `/finance/*` 하위 URL 탭 구조로 개편하고, 입출금 원장/레슨수입/교재내역/선생님 월급/전체수입을 분리한다.
- 완료한 변경: navigation child route, finance redirect, 5개 finance screen, ledger 필터/정렬/calendar/CSV, 수동 등록/수정/삭제, 수강료/회차권/교재/급여 도메인 계약, Supabase migration 계약, 실서비스 조회용 finance management API adapter, 수강료 수납/미수납 RPC, 급여 지급 확정 RPC를 추가했다.
- 커버한 요구사항: 원장 source of truth, 고정 분류, 월/기간 필터, calendar view, CSV export, 월수강료 due date, 회차권 수입, 교재 발주일, 3.3% 원천징수, ledger audit migration.

## 먼저 작성한 테스트

- 테스트 파일:
  - `src/domain/navigation.test.ts`
  - `src/domain/finance-ledger.test.ts`
  - `src/domain/tuition-income.test.ts`
  - `src/domain/payroll.test.ts`
  - `src/lib/api/finance.test.ts`
  - `src/lib/api/finance-management.test.ts`
  - `src/lib/supabase/schema-contract.test.ts`
  - `src/app/finance/page.test.tsx`
  - `src/features/finance/finance-ledger-list-screen.test.tsx`
- 시나리오: finance parent/child route, `/finance` redirect, 입출금 필터/정렬/calendar/CSV, ledger update/delete, 월수강료 생성/overflow, 수강료 수납/미수납 RPC, 급여 계산/지급 RPC, schema/RLS/audit 계약, finance 하위 화면 렌더링.
- 초기 실패: 새 route 파일, finance domain helper, API update/delete, payment RPC adapter, migration SQL, query key 확장, 화면 탭/CSV/action이 없어서 실패했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/navigation.test.ts src/domain/finance-ledger.test.ts src/domain/tuition-income.test.ts src/domain/payroll.test.ts src/lib/api/finance.test.ts src/lib/supabase/schema-contract.test.ts src/app/finance/page.test.tsx src/features/finance/finance-ledger-list-screen.test.tsx src/app/app-shell.test.tsx src/app/page.test.tsx --reporter=dot` | 통과 | 10 files, 80 tests |
| `pnpm test:run --reporter=dot` | 통과 | 59 files, 320 tests, finance management API 추가 전 전체 회귀 |
| `pnpm test:run src/lib/api/finance-management.test.ts src/features/finance/finance-ledger-list-screen.test.tsx src/lib/supabase/schema-contract.test.ts --reporter=dot` | 통과 | 3 files, 36 tests |
| `pnpm test:run --reporter=dot` | 통과 | 60 files, 328 tests |
| `pnpm lint` | 통과 | warning 없음 |
| `pnpm build` | 통과 | Next build/type check 통과, Supabase Node 22 권장 warning만 표시 |
| `pnpm test:e2e` | 통과 | 9 tests |
| `git diff --check` | 통과 | 공백 오류 없음 |

## 브라우저 증거

- URL: `/finance/ledger`, `/finance/lesson-income`, `/finance/books`, `/finance/payroll`, `/finance/overview`
- 데스크톱 스크린샷: E2E에서 주요 메뉴 이동과 finance ledger 진입을 검증했다.
- 모바일 스크린샷: 이번 작업 범위는 기존 AppShell 반응형 구조를 유지하고 finance 화면의 overflow table/grid를 사용했다.
- 비고: Playwright E2E 9개 통과.

## Supabase 증거

- Migration:
  - `supabase/migrations/20260905112952_expand_finance_management.sql`
  - `supabase/migrations/20260905114126_finance_payment_rpcs.sql`
- Remote migration history:
  - `20260905112952_expand_finance_management`
  - `20260905114126_finance_payment_rpcs`
- RLS 확인: `ledger_entries` select/insert/update/delete 정책을 owner/desk finance 범위로 확장했다.
- 역할별 확인: schema contract 테스트가 grant, policy, audit trigger, RPC, ordered_on 컬럼을 검증한다.
- API 확인: finance 하위 조회 화면은 demo가 아닌 환경에서 Supabase read adapter를 사용한다. 급여 계산용 출석 join은 기존 FK `attendance_records_academy_lesson_event_fk`를 기준으로 둔다.
- SQL 확인:
  - `ledger_entries.category`, `ledger_entries.updated_at`, `ledger_entries.updated_by` 존재 확인.
  - `fixed_income_snapshots.due_on`, `lesson_fee`, `discount_total`, `discount_label`, `progress`, `paid_ledger_entry_id` 존재 확인.
  - `book_inventory_batches.ordered_on` 존재 확인.
  - `salary_settlements.paid_ledger_entry_id`와 `salary_settlements_paid_ledger_fk` 존재 확인.
  - `mark_fixed_income_snapshot_paid`, `mark_fixed_income_snapshot_unpaid`, `mark_salary_settlement_paid` 존재와 `authenticated` execute grant 확인.
  - `ensure_monthly_fixed_income_snapshots`는 owner JWT context rollback 검증에서 4건을 반환했다.
  - `mark_fixed_income_snapshot_paid` -> `mark_fixed_income_snapshot_unpaid` rollback 검증에서 ledger 연결 생성/제거를 확인했다.
  - `mark_salary_settlement_paid` rollback 검증에서 paid 상태와 ledger 연결 생성을 확인했다.
- 런타임 오류 수정: `book_releases.ordered_on`은 실제 schema에 없는 컬럼이므로 finance management API select에서 제거했다. 교재내역 발주일은 현재 연결 가능한 출고 row 기준에서는 `BookSale.orderedOn`이 없으면 `shippedAt` fallback으로 표시한다.
- 비고: Supabase CLI가 `2.75.0`이라 runbook 기준 advisor 신뢰 버전(`2.81.3+`)에 미달해 advisor는 실행하지 않았다. MCP schema SQL 검증으로 대체했다.

## 품질 정리

- 코드 단순화: finance 화면 파일명을 `finance-management-screens.tsx`로 바꾸고 기존 `finance-ledger-list-screen.tsx`는 re-export만 남겨 이름과 책임을 맞췄다. payment RPC row 변환은 finance management API adapter에 모았다.
- 재사용한 추상화: navigation SSOT, AppShell child tab, queryKeys, domain helper, demo provider state mutation을 재사용했다.
- 테스트 정리: 새 child route로 바뀐 E2E selector를 exact selector와 새 label로 보정했다.
- 가독성: `ledgerCategoryOptions`, `FinanceLedgerSort`, `buildPayrollRow`, `buildHourlyPayrollRow`, `toPayrollLessonSources`로 의미 있는 이름을 붙였다.
- 예측 가능성: `build*`, `calculate*`, `export*`, `update*`, `delete*`, `mark*Paid`의 side effect 경계를 이름과 위치에 맞췄다.
- 응집도: 원장 필터/CSV/calendar는 `finance-ledger` 도메인에, Supabase row 변환은 finance API adapter에, route 선택은 finance page wrapper에 뒀다.
- 결합도: AppShell은 finance dialog/mutation을 모르고, finance screen이 header action slot을 통해 action만 등록한다.
- simplify 결과: lint warning을 제거하고, 렌더마다 바뀌던 entries 배열을 memoized value로 안정화했다. `ledger_entries` 수정/삭제는 `id`와 `academy_id`를 함께 필터링하고, 수정 payload에서 tenant key를 제외했다.
- 코드 품질 리뷰:
  - Critical: 없음.
  - Warning: 회차권 결제 취소/미수납 정책은 결제금액 보존 방식이 필요해 이번 범위에서 확정하지 않았다.
  - Suggestion: 교재 발주 batch와 원생 출고 row를 정확히 연결하려면 `book_releases`에 `batch_id` 또는 `ordered_on` 스냅샷 정책을 별도 확정한다.
- 남은 부채: 회차권 결제 취소/미수납 전환 정책은 별도 제품 결정 후 구현한다.

## 위험과 확인 질문

- 위험: `allowDeskFinance`는 앱 권한 플래그이므로 DB RLS는 owner/desk까지 열고, 세부 허용 여부는 앱/API 계층에서 통제하는 전제다.
- 후속 질문: 실제 은행 이체/다중 계좌/xlsx export가 필요해지는 시점에 별도 정책 확정이 필요하다.

## Git

- 커밋: 하지 않음.
- push 여부: 하지 않음.
