# 스캐폴드 계획

이 문서는 앱 기반 세팅의 현재 상태와 다음 확장 기준을 기록한다.

## 현재 완료된 기반

- Next.js App Router + TypeScript 프로젝트 구조
- pnpm 기반 의존성 및 lockfile
- shadcn/ui 호환 `components.json`
- Tailwind CSS v4 semantic token 기반 `globals.css`
- shadcn 패턴의 `Button` 컴포넌트
- Vitest unit/component 테스트 설정
- React Testing Library + jest-dom 테스트 환경
- Playwright E2E 설정
- Supabase SSR 클라이언트 골격
- TanStack Query Provider와 tenant-aware query key factory
- `.env.local.example`
- 1차 운영 앱 쉘

## 현재 스크립트

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:run`
- `pnpm test:watch`
- `pnpm test:components`
- `pnpm test:e2e`
- `pnpm test:e2e:ui`

## 소스 구조

- `src/app`: App Router routes/layouts
- `src/components/ui`: shadcn 기반 원천 UI 컴포넌트
- `src/domain`: React와 분리 가능한 도메인 규칙과 타입
- `src/lib`: 프레임워크/인프라 helper
- `src/lib/api`: TanStack Query key와 API 상태 관리 helper
- `src/test`: 테스트 환경 설정
- `tests/e2e`: Playwright 사용자 흐름 테스트
- `supabase/migrations`: 이후 DB migration 위치

## 다음 확장 기준

1. 기능 구현 전 관련 테스트를 먼저 작성한다.
2. 도메인 규칙은 `src/domain`의 순수 로직으로 시작한다.
3. 앱 전용 조합 컴포넌트는 필요해질 때 `src/components/app`에 둔다.
4. Supabase service-role 유틸은 서버 전용 경로에만 둔다.
5. shadcn 컴포넌트를 추가하면 `components.json` alias와 `docs/engineering/design-system.md`를 함께 확인한다.
6. API query key는 항상 `academyId`를 포함해 학원 간 cache 오염을 막는다.

## 현재 결정

- Next 16의 기본 Turbopack production build가 이 로컬 실행 환경에서 내부 포트 바인딩 오류를 냈기 때문에, 기본 `build` 스크립트는 `next build --webpack`으로 고정한다.
- Playwright는 다른 프로젝트의 3000번 포트 재사용을 피하기 위해 `127.0.0.1:3107`을 사용한다.
