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

## 운영 데이터 비우기와 schema reset 구분

운영·검수 데이터를 비우는 작업은 migration이나 `db reset --linked`가 아니다. schema와 migration history를 유지해야 하면 아래 절차로 **한 번만 실행하는 명시적 트랜잭션**을 사용한다. seed를 다시 넣지 않으며 실행 SQL을 migration 폴더에 두지 않는다.

1. 사용자가 삭제 범위, 유지할 Auth 계정·학원·멤버십, 백업 여부를 명시적으로 확정해야 한다.
2. 대상 project ref를 다시 확인하고, 유지 조건(예: 학원 1개·활성 원장 1명)과 유지할 ID를 읽는다. 조건이 다르면 삭제하지 않는다.
3. 삭제 전 public 업무 테이블, Auth 사용자·identity·session, Storage bucket·object, migration 개수·마지막 버전의 건수를 기록한다.
4. 짧은 `lock_timeout`·`statement_timeout`을 둔 단일 트랜잭션에서 업무 테이블을 이름으로 열거해 `TRUNCATE`한다. 보존 테이블에 닿을 수 있는 `CASCADE`는 사용하지 않는다.
5. 보존 대상이 아닌 Auth 사용자를 같은 트랜잭션에서 삭제해 profile·membership·identity·session을 FK 규칙에 따라 정리한다. 감사 trigger가 삭제 중 새 행을 만들 수 있으면 마지막에 `audit_events`를 다시 비운다.
6. 트랜잭션 안에서 유지 데이터의 사후 조건을 확인하고 어긋나면 예외로 전체 롤백한다.
7. 커밋 뒤 모든 업무 테이블 0건, 유지 Auth/profile/academy/membership 일치, Storage 건수, migration 개수·마지막 버전 불변을 다시 조회한다.
8. 원장 로그인과 원생·레슨·회차권·교재·수입 화면의 빈 상태를 확인하고, 삭제 전후 집계와 실패·재시도 내역을 evidence에 남긴다. ID·이메일·토큰 같은 민감값은 문서에 적지 않는다.

`db reset --linked`는 원격 schema를 migration 기준으로 다시 만들고 데이터도 지울 수 있으므로 이 용도로 쓰지 않는다. 개발 브랜치 전체를 재구성하는 별도 요청에만 사용한다.

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

## 원생·선생님·상담 명세 migration (20261018080000~20261018120000) — 2026-10-17 적용 완료

2026-10-17 `원생_선생님_거래처관리_기능명세서` 반영분이다. 사용자 요청으로 같은 날 운영 DB에 적용했다. 앱 코드가 새 컬럼·RPC를 이미 쓰므로 **이 migration이 적용된 상태에서만 새 앱이 동작한다**(앱을 먼저 배포하면 원생 목록·선생님 목록 조회가 실패한다).

| 순서 | 파일 | 내용 | 적용 후 확인 |
| --- | --- | --- | --- |
| 1 | `20261018080000_student_status_and_edit_fixes.sql` | 재원 복귀 시 정기 일정 재생성, 같은 상태 재처리 거부(서버 시각), 원생 수정 RPC(요일별 시간·악기별 배정·서버 검증), 예전 4인자 `update_student_status`·`update_teacher_status` 삭제, `archive_expired_people` 앱 사용자 실행 회수 | `pg_get_functiondef`로 5인자 상태 함수 본문 확인, 4인자 오버로드가 없는지 |
| 2 | `20261018090000_hourly_payroll_from_work_schedule.sql` | `mark_salary_settlement_paid` 시급 분기를 출근 일정 기준 재계산으로 교체 | 시급제 선생님으로 지급 확정 시 화면 금액과 서버 검증이 일치하는지 |
| 3 | `20261018090100_teacher_profile_owner_only_salary.sql` | 선생님 등록·수정 RPC가 급여 인자를 원장에게만 허용 | 데스크 계정으로 급여 없이 등록·수정이 되는지 |
| 4 | `20261018090200_teacher_resident_registration.sql` | 주민등록번호 암호화 저장·원장 전용 열람·audit, 직접 쓰기 차단 트리거 | **Vault에 `teacher_rrn_key`가 실제로 만들어졌는지**(NOTICE만 남기고 넘어갈 수 있음), 함수 소유자의 Vault 읽기 권한, 키 백업 |
| 5 | `20261018100000_consultations.sql` | `consultations` 표·RLS(원장·데스크 전용, 컬럼 단위 grant), 1년 만료 삭제 함수, pg_cron 등록 | `cron.job`에 `lesson-delete-expired-consultations` 존재, 함수 실행, `\dp`로 권한 |
| 6 | `20261018110000_student_pricing_age_discount.sql` | `students.age_as_of_year`, 할인 종류·소개 달 컬럼, 등록·수정 RPC 서버 검증, `update_student_basic_info`, 월 snapshot 생성 시 소개 할인 차감 | 17인자 수정 RPC가 없고 21인자만 남았는지, backfill 결과, 월 snapshot 새로 생성 시 금액 |
| 7 | `20261018120000_teacher_student_roster.sql` | `list_students_for_teacher`, 선생님의 수강 정보 표 직접 조회 차단 | 선생님 계정으로 원생 화면·레슨표·개인레슨 검색이 동작하는지 |

적용 전 절차:
- `pnpm supabase migration list`로 원격 history가 `20261017090000`까지인지 확인하고 `pnpm supabase db push --dry-run`으로 대상이 위 7개뿐인지 본다.
- 6번이 5번(선생님 원생 조회)·1번의 함수를 다시 만들므로 순서를 바꾸지 않는다. 6번은 1번이 만든 17인자 수정 RPC를 `drop`한다.
- 독립 SQL 리뷰(2026-10-17)에서 Critical 2건(선생님 개인레슨 검색 회귀, 담당 선생님 A→B→A unique 위반)을 지적받아 고쳤고, 6번 파일은 리뷰 범위 밖이므로 적용 전에 한 번 더 읽는다.
- 이 SQL들은 로컬에서 실제 Postgres에 적용해 보지 못했다(주민번호·시급 재계산은 PGlite stub으로만 확인). 적용 후 위 확인 항목으로 실제 동작을 검증한다.

적용 기록 (2026-10-17):
- 방법: `.env.local`의 `SUPABASE_ACCESS_TOKEN`으로 `pnpm supabase migration list`(대기 7개 확인) → `pnpm supabase db push --dry-run`(대상이 위 7개뿐) → `pnpm supabase db push --yes`. 7개 모두 오류 없이 적용됐고 NOTICE는 "존재하지 않아 건너뜀"(drop if exists) 5건뿐이다.
- 적용 후 읽기 전용 카탈로그 확인:
  - 함수: 이전 오버로드가 모두 사라졌다(`update_student_status`·`update_teacher_status`는 5인자만, `update_student_profile_from_date`는 21인자만). `list_students_for_teacher`·`set/reveal_teacher_resident_registration`·`update_student_basic_info`는 anon 실행 불가, `archive_expired_people`·`delete_expired_consultations`는 service_role만 실행 가능.
  - Vault: `teacher_rrn_key`가 만들어졌다(값은 읽지 않음). **키 백업 절차는 아직 없다.**
  - pg_cron: `lesson-delete-expired-consultations`(`0 18 * * *`), `lesson-archive-expired-people`이 활성이다.
  - 정책: `consultations` 4개(select·insert·update·delete), `student_instruments`·`student_instrument_weekly_schedules` select는 `*_select_owner_desk` 하나뿐이다. `teachers`에 `teachers_guard_resident_registration` 트리거가 있다.
  - 컬럼: `students.age_as_of_year`, `student_instruments.discount_kinds`·`referral_discount_month`·`referral_discount_amount`, `consultations` 표. 나이가 있는 원생 3명이 모두 backfill됐다.
- 한계: 운영 데이터 행은 읽지 않았고, 선생님·데스크 계정으로 직접 확인하지 못했다. **실제 동작 검증(재원 복귀 일정 재생성, 시급 서버 재계산, 주민번호 저장·열람, 상담 만료 삭제, 선생님 화면, 소개 할인 snapshot)은 앱에서 직접 확인해야 한다.**

## 교재 관리 migration (20261019090000~20261019090100) — 2026-10-17 적용 완료

`docs/product/book-management-spec.md` 반영분이다. 사용자 요청으로 2026-10-17 운영 DB에 적용했다. 앱 코드가 새 컬럼·RPC를 쓰므로 **적용된 상태에서만 새 앱이 동작한다.** 반대로 옛 앱(옛 7인자 `register_book_release` 호출)은 적용 즉시 출고 등록이 실패하므로 앱 배포를 바로 이어서 한다.

| 순서 | 파일 | 내용 | 적용 후 확인 |
| --- | --- | --- | --- |
| 1 | `20261019090000_book_stock_schema.sql` | `books.quantity·stocked_on·title_key`(+active 교재 부분 unique), `book_releases.quantity`, 같은 도서명 교재 병합 이행(재고 0), 원생 삭제 시 판매 기록 보존 FK, `books`·`book_releases` 직접 쓰기 권한 회수 | 병합 결과(같은 학원·도서명 중복 없음, 출고 기록의 `book_id`가 합쳐진 교재를 가리킴), `book_releases_student_id_fkey`가 없고 복합 FK가 `on delete set null (student_id)`인지, `authenticated`의 insert/update/delete 회수 |
| 2 | `20261019090100_book_stock_rpcs.sql` | 교재·출고 RPC 8개, 내부 함수 3개, 옛 7인자 `register_book_release` 삭제 | 새 시그니처만 남았는지(오버로드), anon 실행 불가, `private.*`는 앱 사용자 실행 불가 |

적용 전 절차: `pnpm supabase migration list`로 원격 history가 직전 migration까지인지 확인하고 `pnpm supabase db push --dry-run`으로 대상이 위 2개뿐인지 본다. 병합 이행은 운영 데이터를 바꾸므로(교재 행 삭제, 출고 `book_id` 재연결) 적용 전에 `books`·`book_releases` 행 수와 도서명 중복 현황을 카탈로그가 아니라 사용자가 확인하도록 안내한다. 적용 직후 모든 교재 재고는 0권이라 원장이 실제 권수를 직접 입력해야 출고할 수 있다. SQL은 로컬에서 실제 Postgres에 적용해 보지 못했고 계약 테스트(SQL 문자열)까지만 검증했다.

실패 시: 1번만 적용되고 2번이 실패하면 옛 출고 등록(7인자, security invoker)이 쓰기 권한 회수로 `permission denied`가 나고 새 앱도 아직 못 쓰는 중간 상태가 된다. 2번은 `create or replace`·`drop … if exists` 위주라 원인을 고친 뒤 2번부터 다시 적용하면 된다(1번도 다시 돌려도 병합이 no-op이다). 적용 전에 `select count(*) from books where not active`(보관 교재), `book_inventory_batches` 행 수를 확인한다(병합은 보관 교재를 활성 교재와 묶지 않고, 입고 이력은 대표 교재로 옮긴다). 운영 DB의 collation은 확인하지 않았다(도서명 정규화가 소문자 변환을 DB에 맡기므로 한글·영문 위주 도서명이면 문제없다).

적용 기록 (2026-10-17):
- 적용 전 확인(집계만, 행은 읽지 않음): 교재 2행(보관 0, 도서명 중복 그룹 0), 입고 이력 2행, 출고 2행. 병합할 중복이 없어 이행은 컬럼 채우기만 일어났다.
- 방법: `pnpm supabase migration list`(대기 2개) → `pnpm supabase db push --dry-run`(대상이 위 2개뿐) → `pnpm supabase db push --yes`. 2개 모두 오류 없이 적용됐고 원격 history가 로컬 파일명과 일치한다. NOTICE는 `books_title_key_check` "존재하지 않아 건너뜀"(drop if exists) 1건뿐이다.
- 적용 후 읽기 전용 카탈로그 확인: 공개 RPC 8개가 새 시그니처로만 존재(옛 7인자 `register_book_release` 없음, 오버로드 없음), anon 실행 불가, `private.apply_book_stock_delta`·`mark_book_release_paid`·`assert_book_role`은 앱 사용자 실행 불가. `books`·`book_releases`에서 anon·authenticated는 SELECT만 남았다. `books_title_key_check`, `book_releases_academy_student_fk`(`on delete set null (student_id)`), 인덱스 `books_academy_title_key_active_key`·`book_releases_academy_status_paid_idx`, `book_releases.student_id` nullable 확인. 두 교재의 `title_key`는 모두 채워졌고 재고는 0권, 출고 수량은 1로 이전됐다.
- 한계: 운영 데이터 행은 읽지 않았다. **재고 잠금·동시성, 결제 취소의 원장 삭제, 데스크 거부, 병합 이행(이번에는 중복이 없어 실행되지 않음)은 앱에서 직접 확인해야 한다.**

## 원생 수정 악기 추가·종료·결석 사유 migration (20261020090000~20261020090100) — 2026-10-18 적용 완료

원생 수정의 악기 추가·종료·원자 저장과 개인레슨 결석 사유 반영분이다. 사용자 요청으로 2026-10-18 운영 DB에 적용했다. 앱 코드가 새 RPC(`update_student_with_enrollments`, 7인자 `mark_private_lesson_attendance`)를 호출하므로 **적용된 상태에서만 새 앱이 동작**한다. 반대로 옛 앱은 2번이 옛 6인자 출결 함수를 지우므로 적용 즉시 개인레슨 출결 저장이 실패한다. 적용과 앱 배포를 이어서 한다.

| 순서 | 파일 | 내용 | 적용 후 확인 |
| --- | --- | --- | --- |
| 1 | `20261020090000_student_enrollment_edit.sql` | `student_instruments.started_on·ended_on`, 수강 unique를 활성 행 한정 index로 교체(종료 행 보존·재추가는 새 행), 내부 함수 `private.insert_student_enrollment`·`end_student_enrollment`, 공개 RPC `update_student_with_enrollments`, `ensure_monthly_fixed_income_snapshots` 재정의(시작·종료 달 기준) | 새 RPC 시그니처 1개(5인자)와 anon 실행 불가, `private.*`가 앱 사용자 실행 불가, 두 컬럼 존재, **옛 unique 제약이 사라지고 활성 한정 unique index `student_instruments_active_enrollment_key`(`where active`)만 남았는지**, 같은 악기·수업 형태의 종료 행과 활성 행이 공존할 수 있는지, 기존 활성 수강의 월 수강료 snapshot 결과가 이전과 같은지(시작일·종료일이 없는 행) |
| 2 | `20261020090100_private_absence_reason.sql` | 옛 6인자 `mark_private_lesson_attendance` 삭제, 사유를 받는 7인자 래퍼 | 7인자 시그니처만 남았는지(오버로드 없음), anon 실행 불가, `private.mark_private_lesson_attendance_impl`이 그대로인지 |

적용 전 절차: `pnpm supabase migration list`로 원격 history가 `20261019090100`까지인지 확인하고 `pnpm supabase db push --dry-run`으로 대상이 위 2개뿐인지 본다. 1번은 운영 데이터를 바꾸는 이행이 없다(컬럼 추가와 함수 정의뿐). SQL은 로컬에서 실제 Postgres에 적용해 보지 못했고 계약 테스트(SQL 문자열)와 독립 코드 리뷰까지만 했다.

앱에서 직접 확인할 것(적용 후): ① 복수 악기 원생에서 악기 추가 → 정기 일정 생성(시작일 이후)과 월 수강료 시작 달, ② 악기 종료 → 시리즈 닫힘·오늘 이후 정기 일정 취소·이동/보강/개인레슨 일정 유지, ③ 마지막 악기 종료 거부와 한 호출 안 실패 시 전체 롤백(이름 포함), ④ 종료한 조합 재추가 시 새 수강 행이 생기고(unique 오류 없음) 종료 행은 그대로이며, 예전 기간의 월 수강료가 열어 본 적 없는 달에도 만들어지는지, ⑤ 개인레슨 결석 사유 저장·수정이 회차권 잔액을 바꾸지 않는지, 선생님 계정에서도 동작하는지.

적용 기록 (2026-10-18):
- 방법: `pnpm supabase migration list`(대기 2개, 원격에 없음 확인) → `pnpm supabase db push --dry-run`(대상이 위 2개뿐) → `pnpm supabase db push --yes`. 2개 모두 오류 없이 적용됐고 원격 history가 로컬 파일명과 일치한다. 적용 전에 `20261020090000`을 수강 unique 교체(활성 한정 partial index)와 재추가=새 행 정책으로 제자리 수정했다.
- 적용 후 읽기 전용 카탈로그 확인: `student_instruments`에 옛 4컬럼 unique 제약이 사라지고 PK와 `(academy_id, id)` unique만 남았으며 활성 한정 unique index `student_instruments_active_enrollment_key`가 있다. `started_on`·`ended_on` 컬럼 존재. `update_student_with_enrollments`(5인자)는 authenticated만 실행 가능, `private.insert_student_enrollment`·`end_student_enrollment`·`mark_private_lesson_attendance_impl`은 anon·authenticated 실행 불가, `mark_private_lesson_attendance`는 7인자 하나만 있다(옛 6인자 없음, 오버로드 없음). `ensure_monthly_fixed_income_snapshots`가 시작·종료 달 조건과 `created_at desc, id desc` 정렬을 포함한다.
- 한계: 운영 데이터 행은 읽지 않았다. **원자 롤백, 시리즈 닫기·정기 일정 취소, 종료 행과 활성 행 공존·재추가, snapshot 결과, 결석 재호출의 회차권 영향은 앱에서 직접 확인해야 한다.**

## 운영 화면·입력 흐름 migration (20261020090200~20261020090700) — 2026-10-20 적용 완료

사용자 요청으로 원격 운영 DB에 7개 migration을 적용했다. `pnpm supabase db push --dry-run`에서 대기 파일이 아래 7개뿐임을 확인한 뒤 `pnpm supabase db push --yes`로 적용했다. 이번에는 CLI를 사용해 로컬 파일명과 원격 version을 일치시켰다. 원격 history에서 모두 같은 version으로 확인했다.

| 순서 | 파일 | 주요 변경 |
| --- | --- | --- |
| 1 | `20261020090200_student_grade_anchor.sql` | 학년 기준연도 컬럼·기존 학년 보정·변경 트리거 |
| 2 | `20261020090300_student_secondary_contact.sql` | 두 번째 연락처 등록·수정 RPC, 직접 삭제 권한 회수 |
| 3 | `20261020090350_book_order_ledger_source.sql` | 발주 원장 source enum 값 추가 |
| 4 | `20261020090400_book_orders.sql` | 발주·품목 테이블, 입고·지급·취소 RPC, RLS·권한 |
| 5 | `20261020090500_lesson_audit_history.sql` | 결석 감사 트리거, 원장·데스크용 변경 이력 RPC |
| 6 | `20261020090600_time_unspecified_academy_lessons.sql` | 시간 미정 학원레슨 생성·원생 등록/수정·상태 처리 RPC 재정의 |
| 7 | `20261020090700_book_payment_at_registration_only.sql` | 나중 교재 결제 완료 RPC 실행 권한 회수 |

적용 후 원격 카탈로그에서 컬럼·트리거·RLS·정책·권한·함수 시그니처를 확인했다. 기존 학년의 기준연도 누락은 0건이고 새 발주/품목은 각 0건이다. 스키마 계약/API 테스트는 통과했다. 실제 역할별 JWT로 발주·입고·지급·취소, 출석, 연락처를 실행하는 테스트와 동시성·롤백 검증은 별도 테스트 DB 부재로 못 했다. 자세한 검증과 남은 위험은 `docs/harness/evidence/2026-10-20-operations-input-improvements.md`를 본다.

## 운영 화면 수정 migration (20261021090000~20261021090400) — 2026-10-22 적용 완료

사용자 요청으로 운영 DB에 5개 migration을 적용했다. 앱 코드가 새 RPC·컬럼을 쓰므로 **적용된 상태에서만 새 앱이 동작한다**(앱을 먼저 배포하면 회차권 삭제·환불 규정 저장·거래처 삭제가 실패한다). 교재 등록은 옛 시그니처를 지우므로 옛 앱의 교재 등록·수정도 적용 즉시 실패한다. 적용 후 앱 배포를 바로 잇는다.

| 순서 | 파일 | 주요 변경 |
| --- | --- | --- |
| 1 | `20261021090000_teacher_contract_optional.sql` | `teachers.contract_start_on·contract_end_on` NOT NULL 해제, 선생님 검증 함수 2개 재정의(둘 다 있을 때만 순서 검사) |
| 2 | `20261021090100_vendor_delete.sql` | `delete_vendor`(원장·데스크, 감사 기록) |
| 3 | `20261021090200_book_purchase_vendor.sql` | `books.purchase_vendor_name`, `register_book_stock`·`update_book`을 거래처 인자가 있는 시그니처로 교체(옛 시그니처 삭제) |
| 4 | `20261021090300_academy_settings.sql` | `academy_settings`(RLS, 원장 읽기), `set_lesson_ticket_refund_policy`, `private.lesson_ticket_refund_policy` |
| 5 | `20261021090400_lesson_ticket_delete_refund.sql` | 원장 쓰기 트리거의 회차권 예외, `register_lesson_ticket` 데스크 결제 허용, 환불 계산·`get_lesson_ticket_refund_preview`·`delete_lesson_ticket`, `lesson_ticket_usages_grant_idx` |

적용 기록 (2026-10-22):
- 방법: `pnpm supabase migration list`(대기 5개) → `pnpm supabase db push --dry-run`(대상이 위 5개뿐) → `pnpm supabase db push --yes`. 오류 없이 적용됐고 원격 history가 로컬 파일명과 일치한다. NOTICE는 `books_purchase_vendor_name_check` "존재하지 않아 건너뜀"(drop if exists) 1건뿐이다.
- 적용 후 읽기 전용 카탈로그 확인(Management API, 운영 데이터 행은 읽지 않음): 교재 RPC는 새 7·6인자 시그니처만 존재(옛 시그니처·오버로드 없음), 신규 공개 RPC 4종과 `register_lesson_ticket`은 anon 실행 불가·authenticated 실행 가능, `private.lesson_ticket_refund_*`·`require_finance_owner_for_ledger`는 anon·authenticated 실행 불가, `academy_settings` RLS 활성, 두 컬럼 nullable, `books.purchase_vendor_name` 존재, 인덱스 `lesson_ticket_usages_grant_idx` 존재, 원장 트리거 본문에 NULL 방어(`coalesce(current_setting(...), '')`) 포함.
- 한계: 적용 전 같은 SQL을 pglite(WASM Postgres) 하네스의 최소 스키마 스텁 위에서 실행해 동작을 확인했지만(회차권 28·기타 14 시나리오), 운영 스키마·실제 역할 JWT로는 확인하지 못했다. **앱에서 직접 확인할 것**: ① 데스크 계정의 회차권 등록(결제 금액 입력)과 삭제, 데스크가 입출입내역·수동 수입 행은 여전히 못 쓰는지, ② 원장의 환불 규정 저장·환불 처리·잘못 등록 삭제와 수입 행 감액, ③ 거래처 삭제와 과거 발주 이름 보존, ④ 교재 재입고 거래처 덮어쓰기·유지, ⑤ 계약기간 없는 선생님 등록과 급여.

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
