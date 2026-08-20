# 2026-08-21 Supabase 세션 Proxy 증거

## 목표

Next.js App Router에서 Supabase cookie 기반 세션을 갱신하는 proxy 기반을 추가한다. 로그인/tenant 선택 기능 구현 전에 SSR과 Client Component가 같은 세션을 안정적으로 공유할 수 있는 토대를 만든다.

## 출처 요구사항

- 사용자 질문: Supabase 설정과 실제 DB migration에 무엇이 필요한지 확인
- 사용자 추가 지시: 멀티테넌트 서비스 방향 유지
- Supabase 공식 Next.js SSR 가이드: App Router에서는 Server Component가 cookie를 직접 갱신할 수 없으므로 root `proxy.ts`와 `auth.getClaims()` 기반 session refresh를 사용한다.
- `docs/engineering/supabase-setup.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/lib/supabase/proxy.test.ts`
- 시나리오:
  - request마다 Supabase server client를 만들고 `auth.getClaims()`로 세션을 갱신한다.
  - Supabase가 갱신한 쿠키와 헤더를 응답에 보존한다.
- 초기 실패: `src/lib/supabase/proxy.ts` 파일이 없어 import 단계에서 실패했다.

## 구현 내용

- `src/lib/supabase/proxy.ts`
  - `createServerClient`를 request마다 생성한다.
  - `request.cookies.getAll()`과 `setAll()`을 연결한다.
  - Supabase가 갱신한 cookie와 header를 `NextResponse`에 반영한다.
  - `supabase.auth.getClaims()`를 호출해 세션 갱신을 수행한다.
- `proxy.ts`
  - Next.js root proxy entry를 추가하고 `updateSession`을 호출한다.
  - 정적 파일과 이미지 asset은 matcher에서 제외한다.
- `docs/engineering/architecture.md`
  - Supabase session refresh proxy 원칙을 추가했다.

## 정책 처리

- `@supabase/server`는 설치하지 않았다. 현재 앱은 cookie 기반 Next.js SSR 흐름이므로 `@supabase/ssr`가 맞다.
- `SUPABASE_SECRET_KEY`는 사용하지 않았다. 세션 갱신과 일반 RLS 기반 데이터 접근은 publishable key와 사용자 cookie session으로 처리한다.
- 로그인/가입 방식, 초대 정책, 학원 선택 정책은 다음 phase에서 사용자 확인이 필요한 제품 정책으로 남긴다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/lib/supabase/proxy.test.ts` | 통과 | unit 2개 테스트 통과 |
| `pnpm test:run src/lib/supabase/proxy.test.ts src/lib/supabase/env.test.ts` | 통과 | unit 5개 테스트 통과 |
| `pnpm test:run` | 통과 | 29개 파일, 128개 테스트 통과 |
| `pnpm lint` | 통과 | proxy 추가 후 ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | test mock 타입 정리 후 통과 |
| `pnpm build` | 통과 | root `proxy.ts` 포함 production build 통과 |
| `pnpm test:e2e` | 통과 | Chromium E2E 2개 통과 |

## Quality Consolidation

- proxy는 비밀키나 전역 Supabase client를 사용하지 않고 request-scoped client만 생성한다.
- cookie/header 보존 동작을 테스트로 고정해, 이후 redirect나 보호 route를 추가할 때 세션이 깨지는 회귀를 막는다.
- 인증 정책과 tenant 선택 정책은 구현하지 않고, 다음 phase의 확인 필요 항목으로 분리했다.

## 남은 리스크

- 실제 로그인된 Supabase 세션으로 cookie refresh를 검증하지는 못했다.
- 인증 화면과 가입/초대 정책은 아직 구현하지 않았다.
- 원격 migration 적용과 RLS 런타임 검증은 아직 수행하지 않았다.
- `pnpm build`와 `pnpm test:e2e`에서 Supabase JS가 Node.js 22 이상을 권장한다는 경고가 표시됐다. 배포 런타임은 Node.js 22 이상으로 맞추는 방향을 검토해야 한다.
