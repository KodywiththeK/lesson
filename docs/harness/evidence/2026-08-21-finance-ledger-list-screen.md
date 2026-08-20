# 2026-08-21 입출입 내역 화면 증거

## 목표

PDF 5 수입 관리 요구사항 중 입출입 내역을 `/finance` 화면과 Supabase/TanStack Query API 어댑터로 연결한다. 운영자는 현재 학원의 수입/지출 ledger에서 발생일, 유형, 출처, 금액, 설명을 확인하고 검색/필터할 수 있어야 한다.

## 출처 요구사항

- PDF 5: 수입 관리 탭에는 학원 고정 수입, 입출입 내역, 교재 내역, 선생님 월급, 전체 수입이 있다.
- PDF 5: 입출입 내역은 수동 수입/지출과 교재 결제 완료, 급여 지급에서 만들어지는 자동 내역을 다룬다.
- PDF 목록 공통: 수입 내역은 검색 또는 필터를 제공한다.
- 사용자 추가 지시: API는 TanStack Query 사용
- 사용자 추가 지시: UI는 shadcn/ui 컴포넌트 조합을 우선 사용
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스 방향 유지

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/finance-ledger.test.ts`
  - 현재 학원의 수입/지출 내역을 최신순으로 보여주고 검색과 유형 필터를 적용한다.
  - 입출입 유형과 출처를 운영자가 읽는 한국어로 표시한다.
  - 초기 실패: `buildFinanceLedgerList`, `formatLedgerEntryType`, `formatLedgerEntrySource`가 없었다.
- 테스트 파일: `src/lib/api/query-keys.test.ts`
  - 입출입 내역 query key에 `academyId`, 검색어, 유형, 출처를 포함한다.
  - 초기 실패: `queryKeys.finance.ledgerList`가 없었다.
- 테스트 파일: `src/lib/api/finance.test.ts`
  - Supabase `ledger_entries` row를 입출입 내역으로 변환하고 `academy_id`로 제한한다.
  - Supabase 오류를 사용자에게 전달 가능한 오류로 변환한다.
  - query options가 tenant-aware query key와 query function을 제공한다.
  - 초기 실패: `src/lib/api/finance.ts`가 없었다.
- 테스트 파일: `src/features/finance/finance-ledger-list-screen.test.tsx`
  - 입출입 내역을 표로 보여주고 발생일, 유형, 출처, 금액, 설명을 표시한다.
  - 검색어와 유형/출처 필터 변경을 TanStack Query 입력으로 반영한다.
  - Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다.
  - 초기 실패: `src/features/finance/finance-ledger-list-screen.tsx`가 없었다.
- 테스트 파일: `src/app/finance/page.test.tsx`, `tests/e2e/home.spec.ts`
  - 수입 메뉴에서 `/finance` 수입 관리 화면으로 진입할 수 있다.
  - 초기 실패: `/finance` route가 없었다.

## 구현 내용

- `src/domain/finance-ledger.ts`
  - `buildFinanceLedgerList`
  - `FinanceLedgerListFilters`
  - `formatLedgerEntryType`
  - `formatLedgerEntrySource`
- `src/lib/api/finance.ts`
  - `fetchFinanceLedgerList`
  - `createFinanceLedgerListQueryOptions`
  - Supabase `ledger_entries` row와 도메인 `LedgerEntry` 매핑
- `src/lib/api/query-keys.ts`
  - 입출입 내역 query key에 학원 ID, 검색어, 유형, 출처 포함
- `src/features/finance/finance-ledger-list-screen.tsx`
  - TanStack Query `useQuery` 기반 입출입 내역 화면
  - 검색, 유형 필터, 출처 필터, 초기화, 로딩/빈/오류 상태
  - shadcn `Button`, `Badge`, `Input`, `NativeSelect`, `Alert`, `Table` 조합 사용
- `src/app/finance/page.tsx`
  - `/finance` route 추가
- `tests/e2e/home.spec.ts`
  - 홈 메뉴에서 `/finance`로 이동하는 E2E 추가
- `docs/product/traceability-matrix.md`
  - PDF 5 입출입 내역 요구사항을 도메인/API/화면/E2E 테스트에 연결

## 정책 처리

- Supabase query는 항상 `academy_id`로 제한한다.
- 기존 migration의 `ledger_entries` RLS는 owner-only select를 전제로 한다.
- 수동 수입/지출 등록 mutation은 권한/감사 로그 정책과 함께 별도 phase에서 진행한다.
- 현재 인증/학원 선택 phase 전이므로 `/finance`는 임시 개발 tenant id `academy-demo`를 사용한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/finance-ledger.test.ts src/lib/api/query-keys.test.ts src/lib/api/finance.test.ts src/features/finance/finance-ledger-list-screen.test.tsx src/app/finance/page.test.tsx` | 통과 | 5개 파일, 18개 테스트 통과 |
| `pnpm test:run` | 통과 | 43개 파일, 170개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 통과 |
| `pnpm typecheck` | 통과 | route type 생성 및 `tsc --noEmit` 통과 |
| `pnpm build` | 통과 | `/finance` 정적 빌드 포함 |
| `pnpm test:e2e` | 통과 | 수입 메뉴 이동 포함 6개 E2E 통과 |

## Quality Consolidation

- 검색/필터/정렬 규칙은 `src/domain/finance-ledger.ts` 순수 함수에 두고 UI에서는 호출 결과만 표시한다.
- Supabase client 타입은 `FinanceLedgerListSupabaseClient` adapter port로 좁혀 화면 테스트가 원격 DB에 의존하지 않게 했다.
- 목록 UI는 원생/선생님/거래처/교재와 같은 `src/components/management/list-controls.tsx` shadcn 조합을 재사용했다.
- 사용자에게 보이는 유형/출처 한글 라벨은 도메인 formatter로 모아 테스트 가능하게 했다.

## 남은 리스크

- 원격 Supabase DB에는 아직 migration을 적용하지 않았기 때문에 실제 데이터 조회 성공은 검증하지 못했다.
- 수동 입출입 등록, 교재 결제 완료 mutation, 급여 지급 mutation은 아직 화면으로 구현하지 않았다.
- 전체 수입 그래프의 개별 악기 집계는 ledger와 fixed income snapshot의 source of truth 정리가 필요하다.
- `supabase db push --dry-run`은 통과했지만 실제 `supabase db push`는 사용자 명시 승인 후 실행해야 한다.
- Supabase JS가 Node 22 이상 업그레이드를 권장한다.
