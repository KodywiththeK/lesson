# 원격 데모 Auth 복구

## 배경

- 사용자가 `owner@lesson.local` / `lesson1234`로 로그인했을 때 Supabase Auth가 `invalid_credentials`를 반환했다.
- 원인은 `supabase/seed.sql`의 계정이 로컬 개발 seed로만 준비되어 있고, 원격 Supabase Auth에는 자동 생성되지 않았기 때문이다.
- 원격 seed 적용 중 Hosted Auth의 최신 schema와 맞지 않는 직접 `auth.users` seed row가 들어가 Auth API가 `Database error finding users/querying schema`를 반환했다.

## 변경

- `supabase/migrations/20260821135504_repair_demo_auth_seed.sql`
  - 원격 데모 계정 2개를 Hosted Auth schema에 맞춰 보정한다.
  - `confirmed_at`, `auth.identities.email`처럼 생성 컬럼인 값은 직접 쓰지 않는다.
  - `is_sso_user`, `is_anonymous`, email identity metadata를 명시한다.
- `supabase/seed.sql`
  - 로컬/원격 데모 확인 모두에서 다시 실행 가능한 idempotent seed 형태로 정리했다.
  - `extensions.crypt`, `extensions.gen_salt`를 명시해 원격 `pgcrypto` schema 위치 차이를 흡수했다.
  - 자동 생성 id였던 예시 row에 고정 id를 부여해 seed 재실행 중복을 줄였다.

## 원격 검증

- `supabase db push`
  - `20260821135504_repair_demo_auth_seed.sql` 원격 적용 완료.
- `supabase db push --include-seed`
  - seed hash 최신화 완료.
- Auth REST 로그인 검증
  - `owner@lesson.local` / `lesson1234`: 로그인 성공, session 발급, `academy_members` 1건 조회, role `owner`.
  - `teacher@lesson.local` / `lesson1234`: 로그인 성공, session 발급, `academy_members` 1건 조회, role `teacher`.
- `supabase migration list --linked`
  - local/remote 모두 `20260821135504`까지 일치.
- `supabase db lint --linked --fail-on error`
  - schema error 없음.

## 앱 검증

- `pnpm test:run --reporter=dot`
  - 54 files / 228 tests passed.
- `pnpm lint`
  - 통과.
- `pnpm typecheck`
  - 통과.
- `pnpm build`
  - 통과.
  - 잔여 경고: 현재 Node.js 20에서 `@supabase/supabase-js`의 향후 지원 중단 경고가 출력된다. 이후 Node.js 22 업그레이드가 필요하다.

## 남은 주의점

- production onboarding은 직접 `auth` schema seed가 아니라 Supabase Auth Admin API 또는 사용자 가입 flow로 처리해야 한다.
- 현재 데모 계정은 원격 확인용 고정 계정이므로 실제 운영 사용자와 분리해서 관리한다.
