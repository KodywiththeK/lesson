# Supabase 설정과 마이그레이션

## 목적

Supabase 설정은 앱 실행, 인증 세션 유지, 원격 DB 마이그레이션 적용, RLS 런타임 검증을 구분해서 관리한다. 공개 키와 비밀 키의 용도를 섞지 않는다.

## 앱 실행에 필요한 환경변수

로컬 앱 실행과 브라우저/SSR 일반 Supabase client에는 다음 공개 환경변수만 사용한다.

```ini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 표준으로 사용한다.
- 기존 프로젝트 호환을 위해 `NEXT_PUBLIC_SUPABASE_ANON_KEY`도 읽을 수 있지만 새 설정에는 사용하지 않는다.
- `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 같은 서버 전용 키는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

## 원격 DB 마이그레이션 절차

원격 DB migration 적용에는 공개 API key가 아니라 DB 변경 권한이 필요하다. 상세 실행 절차의 SSOT는 `docs/engineering/supabase-migration-runbook.md`다.

우선순위는 다음과 같다.

1. Supabase MCP `apply_migration`
   - 현재 이 프로젝트에서 권장하는 기본 경로다.
   - `supabase/.temp/project-ref`의 project ref를 `project_id`로 사용한다.
   - 적용 후 MCP `list_migrations`로 원격 history version을 확인한다.
   - MCP가 기록한 version과 로컬 migration 파일명이 다르면 로컬 파일명을 원격 version에 맞춘다.

2. Supabase CLI 로그인과 프로젝트 링크
   - `supabase login`
   - `supabase link --project-ref <project-ref>`
   - 검증: `supabase db push --dry-run`
   - 적용: `supabase db push`

3. Non-pooling Postgres connection string
   - Dashboard의 Database connection string에서 non-pooling URL을 확인한다.
   - 로컬 비공개 환경변수 예: `POSTGRES_URL_NON_POOLING=...`
   - 검증: `supabase db push --dry-run --db-url "$POSTGRES_URL_NON_POOLING"`
   - 적용: `supabase db push --db-url "$POSTGRES_URL_NON_POOLING"`

마이그레이션 적용 명령은 실제 원격 DB를 변경할 수 있으므로 사용자 요청이나 명시 승인이 있을 때만 실행한다.

## 원격 DB 타입 생성

원격 DB에 migration을 적용한 뒤 앱 코드가 실제 schema를 기준으로 타입 검사를 받을 수 있도록 generated type을 갱신한다.

```bash
supabase gen types typescript --linked --schema public --schema private > src/lib/supabase/database.types.ts
```

- `src/lib/supabase/database.types.ts`는 커밋 대상이다.
- browser/server/proxy Supabase helper는 `Database` 타입을 제네릭으로 전달한다.
- schema 변경 migration을 적용한 뒤에는 항상 이 파일을 다시 생성하고 `pnpm typecheck`를 실행한다.

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
- Supabase project ref는 `supabase/.temp/project-ref`에서 확인한다.
- 2026-09-05 기준 CLI linked 경로는 access token 부재로 바로 사용할 수 없었다.
- 2026-09-05 기준 `supabase/.temp/pooler-url`은 password 인증 실패가 발생했으므로 우선 경로로 쓰지 않는다.
- 2026-09-05 기준 원격 migration 적용은 Supabase MCP `apply_migration`으로 수행했고, 적용 후 SQL로 schema를 검증했다.
- 로컬 Docker daemon이 꺼져 있어 `supabase db reset --local`과 `supabase db dump --linked`는 실행 검증하지 못했다.
