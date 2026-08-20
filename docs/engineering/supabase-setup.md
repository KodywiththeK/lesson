# Supabase 설정과 마이그레이션 준비

## 목적

Supabase 설정은 앱 실행, 인증 세션 유지, 원격 DB 마이그레이션 적용, RLS 런타임 검증을 구분해서 준비한다. 공개 키와 비밀 키의 용도를 섞지 않는다.

## 앱 실행에 필요한 환경변수

로컬 앱 실행과 브라우저/SSR 일반 Supabase client에는 다음 공개 환경변수만 사용한다.

```ini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 표준으로 사용한다.
- 기존 프로젝트 호환을 위해 `NEXT_PUBLIC_SUPABASE_ANON_KEY`도 읽을 수 있지만 새 설정에는 사용하지 않는다.
- `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 같은 서버 전용 키는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

## 원격 DB 마이그레이션에 필요한 것

원격 DB migration 적용에는 공개 API key가 아니라 DB 변경 권한이 필요하다. 다음 중 하나를 준비한다.

1. Supabase CLI 로그인과 프로젝트 링크
   - `supabase login`
   - `supabase link --project-ref <project-ref>`
   - 검증: `supabase db push --dry-run`
   - 적용: `supabase db push`

2. Non-pooling Postgres connection string
   - Dashboard의 Database connection string에서 non-pooling URL을 확인한다.
   - 로컬 비공개 환경변수 예: `POSTGRES_URL_NON_POOLING=...`
   - 검증: `supabase db push --dry-run --db-url "$POSTGRES_URL_NON_POOLING"`
   - 적용: `supabase db push --db-url "$POSTGRES_URL_NON_POOLING"`

마이그레이션 적용 명령은 실제 원격 DB를 변경할 수 있으므로 실행 전 사용자에게 확인한다.

## 로컬 DB 검증에 필요한 것

로컬 Supabase 검증에는 Supabase 계정 로그인보다 Docker가 더 중요하다.

- Docker Desktop 실행
- Supabase CLI 사용 가능 상태
- 검증 후보:
  - `supabase db reset --local --no-seed`
  - `supabase db lint --local --fail-on error`
  - `supabase migration list --local`

Docker daemon이 꺼져 있으면 로컬 DB reset/lint는 실패한다.

## `@supabase/ssr`와 `@supabase/server`

- Next.js App Router에서 cookie 기반 세션을 쓰는 일반 SSR 구조는 `@supabase/ssr`를 사용한다.
- `@supabase/server`는 API handler가 `Authorization: Bearer <jwt>`처럼 stateless header 기반 인증을 직접 받아 처리할 때 검토한다.
- 현재 앱의 browser/server helper는 `@supabase/ssr` 기준으로 유지한다.
- `@supabase/server`는 DB migration 적용에 필요하지 않다.

## 비밀 키 정책

- 비밀 키는 repository, 문서, 테스트 fixture, client bundle, evidence 문서에 기록하지 않는다.
- 비밀 키가 채팅, 로그, 스크린샷에 노출되면 Supabase Dashboard에서 회전하거나 폐기한다.
- 관리자 권한 키가 필요한 기능은 별도 server-only module, 권한 테스트, audit 기록, 사용자 승인 후 구현한다.

## 현재 상태

- 앱 실행용 공개 Supabase URL과 publishable key는 로컬 `.env.local`에 설정했다.
- `.env.local`은 `.gitignore` 대상이므로 커밋하지 않는다.
- 원격 migration 적용은 아직 하지 않았다.
- 원격 migration 적용 전 `supabase login`/`supabase link` 또는 non-pooling DB URL이 필요하다.
