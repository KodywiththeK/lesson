# 2026-08-21 거래처 목록 화면 증거

## 목표

PDF 3-4 거래처 관리 요구사항을 실제 `/vendors` 화면과 Supabase/TanStack Query API 어댑터로 연결한다. 원장/데스크는 거래처를 볼 수 있고, 선생님은 거래처 메뉴에 접근하지 못하도록 기존 권한 모델과 네비게이션을 맞춘다.

## 출처 요구사항

- PDF 3-4: 거래처 등록, 거래처명, 연락처, 종류, 비고
- PDF 목록 공통: 검색/필터와 가나다순 목록
- 사용자 추가 지시: API는 TanStack Query 사용
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스 방향 유지
- 사용자 추가 지시: UI는 shadcn/ui 컴포넌트 조합을 우선 사용
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/vendor-list.test.ts`
- 시나리오:
  - 학원 범위 안에서 거래처 목록을 가나다순으로 만든다.
  - 거래처명, 연락처, 종류, 비고 기준 검색을 지원한다.
  - 거래처 종류 필터를 적용한다.
- 초기 실패: `src/domain/vendor-list.ts`가 없어 import 단계에서 실패했다.

- 테스트 파일: `src/lib/api/vendors.test.ts`
- 시나리오:
  - Supabase `vendors` row를 도메인 목록으로 변환하고 `academy_id`로 제한한다.
  - Supabase 오류를 사용자에게 전달 가능한 오류로 변환한다.
  - query options가 tenant-aware query key와 query function을 제공한다.
- 초기 실패: `src/lib/api/vendors.ts`가 없어 import 단계에서 실패했다.

- 테스트 파일: `src/features/vendors/vendor-list-screen.test.tsx`
- 시나리오:
  - 거래처 목록을 표로 보여주고 연락처, 종류, 비고를 표시한다.
  - 검색어와 종류 필터 변경을 TanStack Query 입력으로 반영한다.
  - Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다.
- 초기 실패: `src/features/vendors/vendor-list-screen.tsx`가 없어 import 단계에서 실패했다.

- 테스트 파일: `src/app/vendors/page.test.tsx`, `src/app/app-shell.test.tsx`
- 시나리오:
  - 거래처 메뉴에서 거래처 목록 화면으로 진입할 수 있다.
  - owner에게 거래처 메뉴를 보여주고 teacher에게는 숨긴다.
- 초기 실패: `/vendors` route와 AppShell href-feature mapping이 없어 거래처 링크를 찾지 못했다.

## 구현 내용

- `src/domain/vendor-list.ts`
  - `buildVendorList`
  - 학원 scope, 검색, 거래처 종류 필터
- `src/lib/api/vendors.ts`
  - `fetchVendorList`
  - `createVendorListQueryOptions`
  - Supabase row 타입과 도메인 `VendorListRow` 매핑
- `src/lib/api/query-keys.ts`
  - 거래처 목록 query key에 학원 ID, 검색어, 거래처 종류 포함
- `src/features/vendors/vendor-list-screen.tsx`
  - TanStack Query `useQuery` 기반 거래처 목록 화면
  - 검색, 종류 필터, 초기화, 로딩/빈/오류 상태
  - shadcn `Button`, `Input`, `NativeSelect`, `Alert`, `Table` 조합 사용
- `src/app/vendors/page.tsx`
  - `/vendors` route 추가
- `src/domain/navigation.ts`, `src/app/app-shell.tsx`
  - 거래처 네비게이션 항목과 `vendors` feature mapping 추가
- `tests/e2e/home.spec.ts`
  - 홈 메뉴에서 `/vendors`로 이동하는 E2E 추가
- `docs/product/traceability-matrix.md`
  - PDF 3-4 요구사항을 도메인/API/화면/E2E 테스트에 연결

## 정책 처리

- Supabase query는 항상 `academy_id`로 제한한다.
- 거래처 feature는 기존 권한 모델에 따라 owner/desk에게 보이고 teacher에게는 숨긴다.
- 현재 인증/학원 선택 phase 전이므로 `/vendors`는 임시 개발 tenant id `academy-demo`를 사용한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/vendor-list.test.ts src/lib/api/vendors.test.ts src/features/vendors/vendor-list-screen.test.tsx src/app/vendors/page.test.tsx src/app/app-shell.test.tsx` | 통과 | 5개 파일, 12개 테스트 통과 |
| `pnpm test:run` | 통과 | 37개 파일, 151개 테스트 통과 |
| `pnpm lint` | 통과 | shadcn 생성 파일 보정 후 통과 |
| `pnpm typecheck` | 통과 | route type 생성 및 `tsc --noEmit` 통과 |
| `pnpm build` | 통과 | `/vendors` 정적 빌드 포함 |
| `pnpm test:e2e` | 통과 | 거래처 메뉴 이동 포함 4개 E2E 통과 |

## Quality Consolidation

- 거래처 검색/필터 규칙은 UI가 아니라 `src/domain/vendor-list.ts` 순수 함수로 분리했다.
- Supabase의 넓은 client 타입은 화면에서 좁은 `VendorListSupabaseClient` adapter port로 끊었다.
- 테스트용 query options factory를 주입할 수 있게 해 화면 테스트가 실제 원격 Supabase에 의존하지 않는다.
- 거래처 네비게이션 노출은 기존 `canAccessFeature` 권한 모델을 재사용했다.
- 목록 화면의 반복 UI는 `src/components/management/list-controls.tsx` shadcn 조합을 사용해 원생/선생님/거래처가 같은 패턴을 공유하게 했다.

## 남은 리스크

- 원격 Supabase DB에는 아직 migration을 적용하지 않았기 때문에 실제 데이터 조회 성공은 검증하지 못했다.
- 거래처 등록/수정 mutation은 아직 구현하지 않았다.
- Supabase Auth 기반 tenant 선택, 로그인, RLS 런타임 검증은 다음 phase에서 이어서 처리해야 한다.
- `supabase db push --dry-run`은 통과했지만 실제 `supabase db push`는 사용자 명시 승인 후 실행해야 한다.
- 빌드 중 Supabase JS가 Node 22 이상 업그레이드를 권장한다.
