# Supabase DB 마이그레이션 실행 Runbook

## 목적

이 문서는 이 프로젝트에서 원격 Supabase DB에 migration을 적용하는 표준 절차다. 매번 연결 방법을 추측하지 않고, 현재 repo와 도구 상태에 맞는 경로를 우선순위대로 사용한다.

## 기본 원칙

- DB migration은 실제 데이터를 바꾸는 작업이므로 사용자가 명시적으로 요청했을 때만 적용한다.
- `entity_memos` 삭제, 결제/급여/권한 변경, 컬럼 삭제처럼 되돌리기 어려운 변경은 migration SQL을 먼저 읽고 삭제/변경 범위를 사용자 요청과 대조한다.
- `.env.local`의 공개 키(`NEXT_PUBLIC_*`)는 DB migration에 사용할 수 없다.
- 비밀값은 터미널 출력, 문서, evidence, 채팅에 노출하지 않는다.
- Supabase CLI 명령은 실행 전 `--help`로 현재 옵션을 확인한다.
- Supabase MCP가 사용 가능하면 원격 DDL 적용은 MCP의 `apply_migration`을 우선 사용한다.

## 이 프로젝트의 현재 기준

- Supabase project ref: `zkzqmqtzzlgljkuctpbn`
- project ref 파일: `supabase/.temp/project-ref`
- 앱 실행 환경변수: `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- 현재 CLI 버전 확인 명령: `pnpm supabase --version`
- CLI advisor 주의: Supabase CLI `2.81.3+`가 아니면 `supabase db advisors`를 신뢰 경로로 쓰지 않는다.

## 권장 경로: Supabase MCP로 적용

MCP 도구가 보이면 이 경로를 먼저 사용한다.

1. 관련 Supabase 기준 확인
   - Supabase skill을 읽는다.
   - `https://supabase.com/changelog.md` 또는 changelog 검색으로 schema/Data API/RLS 관련 breaking change를 확인한다.

2. 로컬 migration 파일 확인
   - `supabase/migrations/<timestamp>_<name>.sql`을 읽는다.
   - 삭제, 제약 제거, RLS, grant, trigger, function 변경을 따로 확인한다.
   - public table을 앱에서 `supabase-js`로 접근한다면 필요한 role에 명시적 `grant`가 있는지 확인한다.

3. 프로젝트 ID 확인
   - `supabase/.temp/project-ref`가 있으면 그 값을 `project_id`로 사용한다.
   - 없거나 값이 의심스러우면 추측하지 말고 사용자에게 프로젝트 ref를 질문한다.

4. migration 적용
   - MCP `apply_migration`을 사용한다.
   - `name`은 timestamp 없는 snake_case 이름을 사용한다.
   - `query`는 로컬 migration SQL 전체를 그대로 사용한다.

5. 원격 history 확인
   - MCP `list_migrations`로 적용된 migration 이름과 version을 확인한다.
   - MCP가 원격 history에 기록한 timestamp가 로컬 파일명과 다르면 로컬 migration 파일명을 원격 version에 맞춘다.
   - 이 정렬을 하지 않으면 이후 CLI `db push`에서 migration drift가 생길 수 있다.

6. SQL 검증
   - MCP `execute_sql`로 실제 schema를 확인한다.
   - 최소 확인 항목:
     - 새 컬럼 존재 여부
     - 제거해야 하는 제약/table이 사라졌는지
     - 새 FK/index/trigger/policy 존재 여부
     - 필요한 `grant` 존재 여부

7. 앱 검증
   - schema contract 테스트를 실행한다.
   - 변경된 API 테스트를 실행한다.
   - 영향이 큰 변경이면 관련 UI 테스트, `pnpm build`, E2E를 실행한다.

8. evidence 기록
   - 적용한 remote migration version
   - SQL 검증 결과
   - 실행한 테스트 명령과 결과
   - advisor를 못 돌렸다면 이유
   - 남은 위험

## CLI fallback: 로그인된 linked project

MCP가 없고 Supabase CLI 로그인이 되어 있으면 이 경로를 사용한다.

```bash
pnpm supabase migration list
pnpm supabase db push --dry-run
pnpm supabase db push
pnpm supabase migration list
```

- `SUPABASE_ACCESS_TOKEN`이 없거나 `supabase login`이 되어 있지 않으면 실패한다.
- 실패 메시지가 access token 문제라면 같은 명령을 반복하지 않는다.
- 로그인 또는 access token 제공이 필요한지 사용자에게 묻는다.

## CLI fallback: direct DB URL

MCP가 없고 CLI 로그인도 없으면 valid Postgres connection string이 필요하다.

```bash
POSTGRES_URL_NON_POOLING=...
pnpm supabase db push --dry-run --db-url "$POSTGRES_URL_NON_POOLING"
pnpm supabase db push --db-url "$POSTGRES_URL_NON_POOLING"
```

- 권장 제공값: Dashboard의 non-pooling Postgres URL.
- `.env.local`에 넣을 때는 `POSTGRES_URL_NON_POOLING`처럼 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- `supabase/.temp/pooler-url`은 stale password일 수 있으므로 우선 경로로 쓰지 않는다.
- URL을 출력하지 않는다. 키 존재 여부만 확인한다.
- DNS/network sandbox 오류가 나면 같은 명령을 승인 권한으로 1회 재시도한다.
- 인증 실패가 나면 비밀번호가 틀린 것이므로 반복하지 않고 사용자에게 새 URL이나 CLI 로그인을 요청한다.

## 레슨 시간표 migration 체크리스트 (2026-10-16 시리즈)

**2026-10-15에 적용 완료**(CLI `db push`, 아래 기록 참고). 새 환경에 적용할 때는 아래 순서와 확인 항목을 그대로 따른다.

1. `supabase/migrations/20261016090000_lesson_schedule_workflows.sql` — `lesson_events.time_unspecified`, `monthly_memos.lesson_kind`와 새 unique 제약, `move_academy_lesson_event` 재정의, `resolve_academy_lesson_absence`, `delete_academy_lesson_event`, `cancel_private_lesson_attendance`.
2. `supabase/migrations/20261016090100_lesson_ticket_registration_and_adjustment.sql` — `register_lesson_ticket`, `adjust_lesson_ticket`.

**배포 순서(중요)**: 앱 코드가 `lesson_events.time_unspecified`와 `monthly_memos.lesson_kind` 컬럼을 select/upsert하므로 **migration을 먼저 적용한 뒤 앱을 배포한다**. 순서가 바뀌면 레슨 캘린더 조회가 PostgREST 400으로 실패해 레슨 화면 전체가 "불러오지 못했습니다"로 막힌다.

적용 전 확인:
- 기존 `monthly_memos` 행이 `lesson_kind='academy'`로 채워지는지, 옛 `(academy_id, month)` unique가 모두 제거되는지. migration은 `monthly_memos_academy_month_key`와 `monthly_memos_academy_id_month_key` 두 이름을 지우지만 `drop constraint if exists`라 다른 이름이면 조용히 건너뛴다. 적용 전에 `select conname from pg_constraint where conrelid = 'public.monthly_memos'::regclass and contype = 'u';`로 실제 이름을 확인한다.
- `absence_resolutions` 테이블·FK 이름과 `lesson-workspace.ts`의 embed 힌트가 일치하는지.
- 원격에 이미 같은 이름의 함수가 있다면 인자 시그니처가 다른지(overload 충돌).

적용 후 기록:
- 원격 migration history와 로컬 파일명 timestamp 일치 여부, 실제 함수 정의 SQL, `pnpm vitest run src/lib/supabase/schema-contract.test.ts` 결과.
- 현재 계약 테스트는 SQL 문자열 확인만 하므로 실제 DB 동작(보강 멱등, 차감 복구, 합산)은 적용 후 수동 또는 DB 테스트로 확인한다.

### 적용 기록 (2026-10-15)

- 방법: `.env.local`의 `SUPABASE_ACCESS_TOKEN`으로 `pnpm supabase db push --dry-run` 후 `pnpm supabase db push --yes`(MCP는 이 세션에서 인증되지 않아 CLI fallback 사용).
- 결과: 원격 history `20261016090000`, `20261016090100`이 로컬 파일명과 일치. 스키마 확인: `lesson_events.time_unspecified`, `monthly_memos.lesson_kind` 존재, `monthly_memos`의 옛 `(academy_id, month)` unique 제거와 `monthly_memos_academy_kind_month_key`만 남음, RPC 6종 존재, `guard_resolved_absence_attendance` trigger 활성, 옛 `create_makeup_lesson_event`의 authenticated 실행 권한 회수.
- 적용 후 `notify pgrst, 'reload schema'`로 스키마 캐시를 갱신했다.
- 실제 데이터로 보강 멱등·차감 복구·병합 동작을 확인하는 스모크 테스트는 운영 데이터 읽기 권한이 거부되어 실행하지 못했다.

## 금지 사항

- 공개 Supabase URL/key로 migration을 시도하지 않는다.
- service role key를 브라우저 코드나 `NEXT_PUBLIC_*` 환경변수에 넣지 않는다.
- DB password, access token, service role key를 evidence에 기록하지 않는다.
- 적용 후 원격 history와 로컬 파일명이 불일치한 상태로 끝내지 않는다.
- 실패한 연결 명령을 원인 분석 없이 반복하지 않는다.

## 사용자가 제공해주면 좋은 것

현재는 Supabase MCP가 연결되어 있어 migration 적용 자체는 가능하다. 더 안정적으로 하려면 아래 중 하나가 있으면 좋다.

- 가장 좋음: Supabase MCP 연결 유지와 project ref 확인.
- CLI fallback용: Supabase CLI 로그인 상태 또는 `SUPABASE_ACCESS_TOKEN`.
- direct fallback용: 유효한 `POSTGRES_URL_NON_POOLING`.
- 운영 안전용: migration 적용 대상이 production인지 staging인지 명시.
- 파괴적 변경용: 삭제 대상 데이터의 백업/이관 여부에 대한 명시 결정.
