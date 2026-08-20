# 2026-08-20 권한 인식 운영 UI shell 증거

## 목표

shadcn 기반 운영 관리자 앱 방향에 맞춰 persistent sidebar와 compact main content를 가진 AppShell을 만들고, 역할별 권한에 따라 메뉴와 주요 액션이 달라지도록 구현한다.

## 출처 요구사항

- 사용자 추가 지시: shadcn 기반 디자인 시스템과 일관된 스타일
- `docs/engineering/design-system.md`
- `docs/product/traceability-matrix.md`의 운영 UI, 역할별 권한 항목
- `src/domain/permissions.ts`

## 먼저 작성한 테스트

- 테스트 파일: `src/app/app-shell.test.tsx`
- 시나리오:
  - owner에게 전체 운영 메뉴와 수납/출석 액션 표시
  - teacher에게 거래처/수입 관리성 메뉴와 수납 액션 숨김
  - teacher에게 레슨 시간표, 원생, 내 급여 메뉴 표시
- 초기 실패: `AppShell` 컴포넌트가 없어 테스트가 실패했다.

## 구현 내용

- `src/app/app-shell.tsx`
  - 권한 인식 sidebar
  - owner/teacher 액션 표시 차이
  - 운영 대기열과 우선 개발 흐름
- `src/app/page.tsx`
  - 홈 화면을 `AppShell` 사용으로 단순화

## 정책 처리

- 현재 홈 fixture는 owner 세션으로 둬 기존 대시보드 E2E 기대값을 유지했다.
- 실제 로그인 세션 연결은 다음 인증/Supabase client phase에서 처리한다.
- teacher는 수납 등록 액션과 수입 메뉴를 볼 수 없고, `내 급여` 메뉴만 표시한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/app/app-shell.test.tsx` | 통과 | component 2개 테스트 통과 |
| `pnpm test:run src/app/page.test.tsx` | 통과 | component 2개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 71개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |
| 브라우저 screenshot | 통과 | `/tmp/lesson-shell-desktop.png`, `/tmp/lesson-shell-mobile.png` 확인 |

## Quality Consolidation

- page의 레이아웃 코드를 `AppShell`로 분리해 향후 다른 route에서도 같은 shell을 재사용할 수 있게 했다.
- 메뉴 visibility는 `permissions` 도메인 함수의 파생값으로 만들었다.
- 권한 UI는 RLS를 대체하지 않고 사용자 경험과 서버 액션 사전 차단을 위한 표면으로만 사용한다.
- 모바일에서는 sidebar를 compact horizontal nav로 표시해 첫 화면에서 업무 대시보드가 바로 보이게 조정했다.

## 남은 질문

- 실제 auth session이 없을 때 로그인 화면을 별도 route로 둘지, 홈에서 redirect할지?
- teacher의 출석 확인 액션 범위는 배정 수업 전체인지 개인레슨만인지?
- 모바일 sidebar를 drawer로 바꿀지, 상단 nav로 축약할지?
