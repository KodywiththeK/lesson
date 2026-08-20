# 2026-08-20 0단계 기반 세팅 증거

## 목표

PDF 명세를 읽은 뒤 학원관리 앱 개발을 시작할 수 있도록 Next.js, Supabase, shadcn/ui, TDD, Playwright 기반 하네스의 0단계를 구현한다.

## 먼저 작성한 테스트

- `src/domain/navigation.test.ts`: PDF 1차 범위의 주요 운영 메뉴가 도메인 내비게이션 모델에 포함되는지 검증했다.
- 초기 실패: `src/domain/navigation.ts`가 없어 module not found로 실패했다.
- `src/app/page.test.tsx`: 첫 화면에 운영 대시보드, 주요 메뉴, 핵심 상태 카드가 보이는지 검증했다.
- 초기 실패: `src/app/page.tsx`가 없어 module not found로 실패했다.
- `src/lib/supabase/env.test.ts`: 브라우저용 Supabase 설정이 공개 환경변수만 읽고 필수 누락 시 명확히 실패하는지 검증했다.
- 초기 실패: unit test 범위가 좁아 수집되지 않아 `vitest.config.ts`를 보강했고, 이후 `src/lib/supabase/env.ts`가 없어 module not found로 실패했다.

## 구현 내용

- Next.js App Router 기본 파일을 추가했다.
- shadcn/ui 호환 설정과 `Button` 컴포넌트를 추가했다.
- PDF 1차 범위 기반 주요 메뉴 모델을 추가했다.
- 운영 대시보드 첫 화면을 추가했다.
- Supabase SSR 브라우저/서버 클라이언트 골격을 추가했다.
- Playwright E2E를 전용 포트 `127.0.0.1:3107`로 분리했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run` | 통과 | unit/component 6개 테스트 통과 |
| `pnpm lint` | 통과 | `eslint .` 기준 |
| `pnpm typecheck` | 통과 | 빌드 완료 후 단독 실행 |
| `pnpm build` | 통과 | `next build --webpack` 기준 |
| `pnpm test:e2e` | 통과 | Chromium 1개 시나리오 통과 |

## 조정한 문제

- 최신 `typescript@7`, `eslint@10`, `vitest@4`, `jsdom@30` 조합이 현재 Node/도구 생태계와 맞지 않아 안정 범위로 고정했다.
- Next 16 Turbopack production build가 로컬 실행 환경에서 내부 포트 바인딩 오류를 내어 webpack build 경로로 고정했다.
- Playwright가 기존 3000번 서버를 재사용해 다른 앱을 테스트하던 문제를 전용 포트로 해결했다.

## Quality Consolidation

- 내비게이션 항목을 UI 문자열 하드코딩 대신 `src/domain/navigation.ts`로 분리했다.
- 테스트 환경에 `cleanup()`을 명시해 컴포넌트 테스트 간 DOM 누수를 제거했다.
- Supabase env helper는 service-role key를 반환하지 않도록 테스트로 고정했다.

## 남은 질문

- 실제 Supabase 프로젝트 URL과 anon key는 아직 연결하지 않았다.
- 원장/데스크/선생님별 세부 권한 정책은 이후 2단계에서 사용자 확인이 필요하다.
- 급여 계산, 할인 정책, 회차권 만료 임박 기준은 구현 전 확인이 필요하다.
