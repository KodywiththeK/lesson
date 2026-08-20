# 2026-08-21 교재 구매 목록 화면 증거

## 목표

PDF 4 교재 관리 요구사항 중 구매 목록을 `/books` 화면과 Supabase/TanStack Query API 어댑터로 연결한다. 운영자는 현재 학원의 교재 출고 내역에서 원생명, 교재명, 자동 입력 가격, 출고일, 결제 상태를 확인할 수 있어야 한다.

## 출처 요구사항

- PDF 4: 교재 흐름은 등록 -> 재고 -> 구매 목록 -> 출고 -> 결제 완료
- PDF 4: 구매 목록은 원생, 교재명, 자동 입력된 가격, 출고일을 기록한다.
- PDF 4: 출고 후 결제 대기, 결제 완료 상태를 관리한다.
- PDF 목록 공통: 교재 목록은 검색 또는 필터를 제공한다.
- 사용자 추가 지시: API는 TanStack Query 사용
- 사용자 추가 지시: UI는 shadcn/ui 컴포넌트 조합을 우선 사용
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스 방향 유지

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/book-sale.test.ts`
  - 검색어와 결제 상태 필터가 교재 구매 목록에 적용된다.
  - 초기 실패: 기존 `buildBookPurchaseList`가 `search`, `filters.status`를 처리하지 않아 모든 항목을 반환했다.
- 테스트 파일: `src/lib/api/query-keys.test.ts`
  - 교재 구매 목록 query key에 `academyId`, 검색어, 결제 상태를 포함한다.
  - 초기 실패: `queryKeys.books.purchaseList`가 없었다.
- 테스트 파일: `src/lib/api/books.test.ts`
  - Supabase `book_releases` row를 구매 목록으로 변환하고 `academy_id`로 제한한다.
  - Supabase 오류를 사용자에게 전달 가능한 오류로 변환한다.
  - query options가 tenant-aware query key와 query function을 제공한다.
  - 초기 실패: `src/lib/api/books.ts`가 없었다.
- 테스트 파일: `src/features/books/book-purchase-list-screen.test.tsx`
  - 교재 구매 목록을 표로 보여주고 원생명, 교재명, 자동 입력 가격, 출고일, 결제 상태를 표시한다.
  - 검색어와 결제 상태 필터 변경을 TanStack Query 입력으로 반영한다.
  - Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다.
  - 초기 실패: `src/features/books/book-purchase-list-screen.tsx`가 없었다.
- 테스트 파일: `src/app/books/page.test.tsx`, `tests/e2e/home.spec.ts`
  - 교재 메뉴에서 `/books` 교재 관리 화면으로 진입할 수 있다.
  - 초기 실패: `/books` route가 없었다.

## 구현 내용

- `src/domain/book-sale.ts`
  - `BuildBookPurchaseListOptions.search`
  - `filters.status`
  - `formatBookSaleStatus`
- `src/lib/api/books.ts`
  - `fetchBookPurchaseList`
  - `createBookPurchaseListQueryOptions`
  - Supabase `book_releases` row와 도메인 `BookSale` 매핑
- `src/lib/api/query-keys.ts`
  - 교재 구매 목록 query key에 학원 ID, 검색어, 결제 상태 포함
- `src/features/books/book-purchase-list-screen.tsx`
  - TanStack Query `useQuery` 기반 교재 구매 목록 화면
  - 검색, 결제 상태 필터, 초기화, 로딩/빈/오류 상태
  - shadcn `Button`, `Badge`, `Input`, `NativeSelect`, `Alert`, `Table` 조합 사용
- `src/app/books/page.tsx`
  - `/books` route 추가
- `tests/e2e/home.spec.ts`
  - 홈 메뉴에서 `/books`로 이동하는 E2E 추가
- `docs/product/traceability-matrix.md`
  - PDF 4 교재 구매 목록 요구사항을 도메인/API/화면/E2E 테스트에 연결

## 정책 처리

- Supabase query는 항상 `academy_id`로 제한한다.
- 결제 완료 mutation, 결제 완료 기록 삭제 정책, 재고 등록/출고 mutation은 이번 phase에서 새로 결정하지 않았다.
- 현재 인증/학원 선택 phase 전이므로 `/books`는 임시 개발 tenant id `academy-demo`를 사용한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/book-sale.test.ts src/lib/api/query-keys.test.ts src/lib/api/books.test.ts src/features/books/book-purchase-list-screen.test.tsx src/app/books/page.test.tsx` | 통과 | 5개 파일, 20개 테스트 통과 |
| `pnpm test:run` | 통과 | 40개 파일, 160개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 통과 |
| `pnpm typecheck` | 통과 | route type 생성 및 `tsc --noEmit` 통과 |
| `pnpm build` | 통과 | `/books` 정적 빌드 포함 |
| `pnpm test:e2e` | 통과 | 교재 메뉴 이동 포함 5개 E2E 통과 |

## Quality Consolidation

- 교재 구매 목록 검색/상태 필터는 화면이 아니라 `src/domain/book-sale.ts` 순수 함수에서 처리한다.
- Supabase client 타입은 `BookPurchaseListSupabaseClient` adapter port로 좁혀 화면 테스트가 원격 DB에 의존하지 않게 했다.
- 목록 UI는 원생/선생님/거래처와 같은 `src/components/management/list-controls.tsx` shadcn 조합을 재사용했다.
- 가격 표시는 화면 전용 `formatWon`으로 두고, ledger 금액 계산과 섞지 않았다.

## 남은 리스크

- 원격 Supabase DB에는 아직 migration을 적용하지 않았기 때문에 실제 데이터 조회 성공은 검증하지 못했다.
- 교재 등록, 재고 목록, 출고 mutation, 결제 완료 mutation은 아직 화면으로 구현하지 않았다.
- 결제 완료 기록 삭제/수정 정책은 `docs/product/open-questions.md`에 확인 필요로 남아 있다.
- `supabase db push --dry-run`은 통과했지만 실제 `supabase db push`는 사용자 명시 승인 후 실행해야 한다.
- Supabase JS가 Node 22 이상 업그레이드를 권장한다.
