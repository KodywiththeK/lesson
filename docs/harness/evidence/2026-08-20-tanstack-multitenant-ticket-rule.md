# 2026-08-20 TanStack Query, 멀티테넌트 방향, 회차권 규칙 증거

## 목표

사용자 추가 지시에 따라 API 상태 관리는 TanStack Query를 사용하고, 제품은 여러 음악학원이 가입하는 멀티테넌트 서비스로 개발한다. 이어서 1단계 도메인 규칙 중 회차권 차감 규칙을 TDD로 구현한다.

## 반영한 결정

- `@tanstack/react-query@5.101.4`를 설치했다.
- 앱 루트에 `AppProviders`를 추가해 TanStack Query client를 제공한다.
- query key factory는 `academyId`를 포함해 학원 간 cache 오염을 막는다.
- 제품 문서와 아키텍처 문서를 더 클래식 단일 앱이 아니라 여러 음악학원 tenant가 사용하는 서비스 기준으로 전환했다.

## 먼저 작성한 테스트

- `src/app/providers.test.tsx`: 하위 컴포넌트가 `QueryClient`에 접근할 수 있는지 검증했다.
- 초기 실패: `src/app/providers.tsx`가 없어 module not found로 실패했다.
- `src/lib/api/query-keys.test.ts`: query key에 `academyId`가 포함되고 학원별 key가 분리되는지 검증했다.
- 초기 실패: `src/lib/api/query-keys.ts`가 없어 module not found로 실패했다.
- `src/domain/lesson-ticket.test.ts`: 출석만 차감, 결석/일정 등록 미차감, tenant mismatch 차단, 중복 차감 방지를 검증했다.
- 초기 실패: `src/domain/lesson-ticket.ts`가 없어 module not found로 실패했다.
- `src/app/page.test.tsx`, `tests/e2e/home.spec.ts`: 첫 화면이 단일 더 클래식 앱이 아니라 서비스형 “음악학원 관리”로 보이고, 더 클래식은 현재 학원으로 표시되는지 검증했다.
- 초기 실패: 기존 화면 제목이 `더 클래식 학원관리`라 테스트가 실패했다.

## 구현 내용

- `src/app/providers.tsx`: TanStack Query `QueryClientProvider`
- `src/lib/api/query-keys.ts`: tenant-aware query key factory
- `src/domain/lesson-ticket.ts`: 회차권 차감 순수 함수
- `src/app/page.tsx`: 서비스형 화면 문구 정리
- `docs/product/product-brief.md`, `docs/engineering/architecture.md`, `docs/engineering/data-model-draft.md`, `docs/harness/decision-log.md`: 한국어 멀티테넌트 방향 반영
- `docs/product/traceability-matrix.md`: 구현된 요구사항과 테스트/파일 연결

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run` | 통과 | unit/component 14개 테스트 통과 |
| `pnpm lint` | 통과 | `eslint .` 기준 |
| `pnpm typecheck` | 통과 | `tsc --noEmit` 기준 |
| `pnpm build` | 통과 | `next build --webpack` 기준 |
| `pnpm test:e2e` | 통과 | Chromium 1개 시나리오 통과 |

## Quality Consolidation

- 제품명 미확정 상태에서 서비스명을 invent하지 않고 첫 화면 제목을 일반화했다.
- 더 클래식은 제품 전체 이름이 아니라 현재/reference 학원으로만 표시했다.
- 회차권 차감 로직은 React와 Supabase에 의존하지 않는 순수 함수로 분리했다.
- TanStack Query cache key는 학원 범위를 기본 prefix로 강제했다.

## 남은 질문

- 서비스의 실제 브랜드명은 아직 정하지 않았다.
- 실제 Supabase tenant schema와 RLS migration은 아직 만들지 않았다.
- 원장/데스크/선생님의 세부 권한 차이는 2단계에서 확인이 필요하다.
