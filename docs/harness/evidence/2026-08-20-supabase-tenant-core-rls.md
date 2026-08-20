# 2026-08-20 Supabase tenant core schema와 RLS 증거

## 목표

여러 음악학원이 가입해 사용하는 서비스 방향에 맞춰 Supabase의 tenant 중심 스키마와 RLS 기초 정책을 준비한다.

## 출처 요구사항

- 사용자 추가 지시: 더 클래식 전용 앱이 아니라 여러 음악학원 원장/선생님이 가입하는 서비스
- `docs/product/product-brief.md`의 멀티테넌트 방향
- `docs/engineering/data-model-draft.md`
- `docs/engineering/permissions.md`
- Supabase RLS 공식 문서: public schema 테이블에는 RLS를 활성화해야 하고 policy에는 `TO authenticated`와 실제 row predicate를 함께 둔다.
- Supabase CLI 공식 문서: `supabase/`, `config.toml`, `migrations/`, `seed.sql`을 로컬 개발 workflow의 버전 관리 대상으로 둔다.

## 구현 내용

- `supabase/config.toml`
- `supabase/seed.sql`
- `supabase/migrations/20260820142318_tenant_core_schema.sql`
  - `profiles`
  - `academies`
  - `academy_members`
  - `teachers`
  - `students`
  - `student_teacher_assignments`
  - `vendors`
  - `ledger_entries`
  - `private` schema의 RLS helper 함수
  - public 운영 테이블 RLS 활성화
  - owner, desk, teacher 역할 기반 policy

## 보안 처리

- `auth.role()`은 사용하지 않고 policy의 `TO authenticated`를 사용했다.
- `raw_user_meta_data`, `user_metadata` 같은 사용자 수정 가능 metadata를 권한 판단에 사용하지 않았다.
- RLS helper는 `private` schema에 두고, public schema에 노출하지 않았다.
- RLS 재귀를 피해야 하는 membership lookup helper는 `SECURITY DEFINER`로 만들되 `auth.uid()` 조건을 함수 내부에 포함하고, `search_path = public, pg_temp`를 명시했다.
- helper 함수는 `PUBLIC` execute 권한을 revoke하고 `authenticated`에만 execute를 grant했다.
- teacher는 배정된 원생만 볼 수 있고, vendors와 ledger는 owner/desk 또는 owner-only 기준으로 제한했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `supabase --version` | 통과 | CLI 2.75.0 |
| `supabase --help` / `supabase init --help` / `supabase migration new --help` | 통과 | 명령 사용 전 help 확인 |
| `supabase init` | 통과 | `supabase/config.toml` 생성 |
| `supabase migration new tenant_core_schema` | 통과 | migration 파일 CLI로 생성 |
| `rg -n "auth\\.role\\(|raw_user_meta_data|user_metadata" ...` | 통과 | 금지 패턴 없음 |
| `rg -n "enable row level security" ...` | 통과 | 8개 public 운영 테이블 RLS 활성화 확인 |
| `rg -n "security definer|set search_path = public, pg_temp|revoke all on function private|grant execute on function private" ...` | 통과 | helper 함수 보안 설정 확인 |
| `pnpm test:run` | 통과 | unit/component 61개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |
| `supabase db reset --local` | 미완료 | Docker Desktop이 설치되어 있지 않아 로컬 DB 적용 검증 불가 |
| `supabase migration list --local` | 미완료 | 로컬 Postgres가 떠 있지 않아 connection refused |

## Quality Consolidation

- RLS의 중심 기준을 `academy_members`로 통일했다.
- 학원 생성자 bootstrap을 위해 academy creator가 자신을 owner membership으로 등록할 수 있는 정책을 별도로 두었다.
- public schema의 table은 모두 RLS를 켰고, Data API 노출 가능성을 고려해 authenticated role grant와 RLS policy를 함께 작성했다.

## 남은 질문

- 로컬 Docker 또는 원격 Supabase dev project를 어떤 방식으로 연결해 migration을 실제 적용 검증할지?
- 데스크 직원의 수입 관리 권한을 어디까지 허용할지?
- 선생님에게 원생 보호자 연락처를 노출할지?
