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
   - MCP가 원격 history에 기록한 timestamp가 로컬 파일명과 다르면 먼저 **의존 migration의 순서**를 대조한다. 이름만 바꾸면 선행 migration보다 앞서 실행되는 경우에는 로컬 파일을 이동하지 않는다.
   - 순서가 유지되는 경우에는 로컬 파일명을 원격 version에 맞춘다. 순서가 깨지는 경우에는 적용된 SQL과 원격 이력 한 건을 검증한 뒤 공식 CLI `migration repair --help` 절차로 **이력 버전만** 정렬한다. 이력 복구가 승인·검증되기 전에는 `db push`로 같은 SQL을 재적용하지 않는다.

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

후속 `20261016090200_lesson_ticket_registration_history.sql`은 회차권 등록 이력, 범위 유일성, 역할별 권한, 기간 공백 방어를 추가한다. **2026-10-16에 운영 DB에 SQL 적용 완료**했다. 적용 전 학원·원생·악기 중복, `registered_at <> valid_from`, 등록 감사 이벤트가 2회 이상인 회차권, 연결 원장이 2건 이상인 회차권을 확인했고 모두 0건이었다. MCP가 임시 버전 `20261015224536`으로 기록했으나, 적용 SQL·기존 4건 backfill을 확인한 뒤 사용자 승인을 받아 공식 CLI `migration repair`로 `20261016090200`을 applied로 표시하고 임시 버전을 reverted로 제거했다. 순서가 깨지므로 로컬 파일명을 임시 버전으로 바꾸거나 SQL을 재적용하지 않았다. 격리 DB 역할별 실행 검증은 Docker 부재로 수행하지 못했다.

`20261016090300_preserve_lesson_ticket_expiry_on_reregistration.sql`은 재등록 시 기존 만료일을 앞당기지 않도록 등록 RPC만 재정의한다. 2026-10-16 운영 DB에 CLI `db push --dry-run`으로 이 파일 하나만 대상임을 확인한 뒤 적용했고, 원격 함수 정의에 `greatest`와 등록 이력의 최종 만료일 사용이 반영됐음을 확인했다.

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

## 수입 관리 명세 migration (20261017090000) — 2026-10-16 적용 완료

`supabase/migrations/20261017090000_finance_income_spec.sql`을 적용했다. 이 migration 없이는 3상태·급여 지급/취소·교재 결제 완료·원장 연결이 실패하므로 **migration을 먼저 적용한 뒤 앱을 배포한다.**

포함 내용:
- `fixed_income_snapshots.status`에 `overdue`(미납) 추가, `mark_fixed_income_snapshot_overdue`(미납), `clear_fixed_income_snapshot_overdue`(미납 해제, 미납만), `mark_fixed_income_snapshot_paid`(미입금·미납에서만, 0원 거부), `mark_fixed_income_snapshot_unpaid`(입금 취소, 입금 완료만, 연결 id가 비어도 ref로 원장 삭제). 모두 owner 전용.
- `mark_salary_settlement_paid`: 선생님·월 advisory lock, 같은 달 중복 지급 거부, 보낸 등원 수업 목록이 그 선생님·그 달(한국 시간)의 실제 등원 수업 전체와 같은지 검증, 월급제·시급제 서버 재계산, 세금(3.3% 내림) 검증, 비율제는 등원 기록 존재 확인. `cancel_salary_settlement_paid`: 같은 달 지급 완료가 여러 건이어도 모두 되돌림.
- 교재: `book_releases.paid_ledger_entry_id`(FK, 기존 결제 완료 건 backfill), `complete_book_release_payment`(신규), `register_book_release`(같은 시그니처 재정의).

적용 전에 확인한 것: 원격 카탈로그로 함수 시그니처·반환 타입, `fixed_income_snapshots_status_check` 정의(`unpaid, paid`뿐), `salary_settlements` unique, `book_releases` 컬럼·trigger를 확인했고, 별도 독립 SQL 리뷰(Critical 1·Warning 3 지적을 모두 반영)를 거쳤다.

적용 기록:
- 방법: `pnpm supabase db push --dry-run`(대상이 이 파일 하나뿐) 후 `pnpm supabase db push --yes`. 원격 history `20261017090000`이 로컬 파일명과 일치한다.
- 스키마 검증(읽기 전용 카탈로그 조회): status check가 `unpaid, paid, overdue`, 함수 8종 모두 anon 실행 불가·authenticated 실행 가능, `book_releases.paid_ledger_entry_id` 컬럼과 `book_releases_paid_ledger_fk`(`on delete set null`) 존재, `mark_salary_settlement_paid`에 advisory lock·`Asia/Seoul`·비율제 가드 포함. 이어서 `notify pgrst, 'reload schema'`로 스키마 캐시를 갱신했다.
- 한계: 운영 데이터 행은 읽지 않았다(분류기 거부 선례). 동시 지급 락, 서버 재계산 일치, 교재 backfill 결과 같은 **실제 DB 동작은 계약 테스트(SQL 문자열)와 문법 검사까지만** 검증했다.

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
