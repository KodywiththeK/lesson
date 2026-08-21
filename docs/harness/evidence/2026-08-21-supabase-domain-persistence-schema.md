# 2026-08-21 Supabase 도메인 persistence 스키마 증거

## 목표

PDF 도메인 규칙과 표시 모델을 실제 Supabase persistence로 이어가기 위해 원생 악기 설정, 수업 이벤트, 출결, 회차권, 교재, 수입, 급여, 감사 로그 테이블을 migration에 추가한다.

## 출처 요구사항

- 사용자 추가 지시: 여러 음악학원이 가입해 사용하는 멀티테넌트 서비스
- 사용자 추가 지시: Supabase, TanStack Query, TDD, 검증 증거
- `docs/product/traceability-matrix.md`
- `docs/engineering/data-model-draft.md`
- Supabase changelog 확인: 새 public 테이블 Data API 자동 노출 변경, RLS와 명시 grant 필요성

## 먼저 작성한 테스트

- 테스트 파일: `src/lib/supabase/schema-contract.test.ts`
- 시나리오:
  - PDF 도메인 persistence 테이블이 migration에 포함되어야 한다.
  - 모든 PDF 도메인 테이블에 RLS가 활성화되어야 한다.
  - Data API 노출을 위해 `authenticated` role grant를 명시해야 한다.
  - deprecated `auth.role()`을 사용하지 않아야 한다.
  - 선생님 주민등록번호는 원문 컬럼 없이 보안 참조와 마스킹 값만 있어야 한다.
  - audit table과 회차권 수동 수정 감사 테이블이 있어야 한다.
  - 학원 생성 직후 owner 멤버십 생성 전에도 생성자 `.insert().select()` 흐름이 RLS에 막히지 않아야 한다.
- 초기 실패: 새 테이블, RLS, 주민등록번호 보안 컬럼, audit 테이블이 migration에 없어 4개 테스트가 실패했다.

## 구현 내용

- `supabase migration new pdf_domain_persistence`
  - 생성 파일: `supabase/migrations/20260820151645_pdf_domain_persistence.sql`
- 추가 테이블:
  - `student_contacts`
  - `student_instruments`
  - `lesson_events`
  - `attendance_records`
  - `absence_resolutions`
  - `monthly_memos`
  - `lesson_ticket_grants`
  - `lesson_ticket_adjustments`
  - `lesson_ticket_usages`
  - `books`
  - `book_inventory_batches`
  - `book_releases`
  - `fixed_income_snapshots`
  - `teacher_salary_settings`
  - `salary_settlements`
  - `audit_events`
- `teachers` 확장:
  - `resident_registration_encrypted_ref`
  - `resident_registration_masked`
- 모든 신규 public 테이블:
  - RLS 활성화
  - `authenticated` role 명시 grant
  - 학원 멤버십 기반 select/write 정책
- 추가 보완 migration:
  - `20260821110548_academy_creator_bootstrap_select.sql`
  - 학원 생성 직후 owner 멤버십 row를 만들기 전에도 생성자가 학원 row를 조회할 수 있도록 bootstrap select 정책 추가
- 적용 전 설계 보강:
  - public schema 기본 권한을 닫고 필요한 객체만 명시 grant하는 구조로 강화
  - tenant scope 참조 테이블에 `(academy_id, id)` 복합 unique key 추가
  - child table에 `(academy_id, *_id)` 복합 FK 추가
  - `updated_at` 공통 trigger 추가
  - 원생 보호자 연락처는 owner/desk 전용으로 제한

## 정책 처리

- 모든 운영 테이블은 `academy_id`를 가진다.
- 선생님 주민등록번호 원문 컬럼은 만들지 않았다.
- 수입, 급여, 감사, 회차권 수동 수정은 보수적으로 owner 중심 정책으로 잠갔다.
- teacher의 출석 처리 범위 같은 미확정 권한은 넓게 열지 않고 owner/desk write로 시작했다.
- public schema Data API 노출 변경에 대비해 RLS와 grant를 함께 명시했다.
- RLS는 권한 경계, 복합 FK는 tenant 데이터 무결성 경계로 분리했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/lib/supabase/schema-contract.test.ts` | 통과 | schema contract 12개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 207개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 8개 테스트 통과 |
| `supabase db lint --local --fail-on error` | 미실행 | 승인 환경에서도 local Postgres 54322 connection refused |
| `supabase db reset --local` | 실패 | Docker daemon 미실행으로 local reset 불가 |
| `supabase db push --dry-run --linked` | 통과 | 원격 변경 없이 적용 예정 migration 2개 확인 |
| `supabase db push --linked` | 통과 | 원격 `lesson` 프로젝트에 migration 2개 적용 |
| `supabase migration list --linked` | 통과 | local/remote migration 이력 일치 |
| `supabase db lint --linked --fail-on error` | 통과 | 원격 schema 오류 없음 |
| `supabase gen types typescript --linked --schema public --schema private` | 통과 | `src/lib/supabase/database.types.ts` 생성 |
| `supabase db dump --linked --schema public,private` | 실패 | Docker daemon 미실행으로 dump 불가 |
| `supabase db push --dry-run --linked` | 통과 | bootstrap select migration 1개 대기 확인 |
| `supabase db push --linked` | 통과 | bootstrap select migration 원격 적용 |

## Quality Consolidation

- 스키마 검증을 단순 migration 존재 확인이 아니라 도메인 테이블, RLS, grant, 민감정보 원문 금지 계약으로 만들었다.
- Supabase changelog 기준으로 새 public 테이블이 Data API에 자동 노출되지 않는 변화에 대비해 grant를 명시했다.
- Postgres regex 호환성을 위해 월 형식 check는 `\d` 대신 `[0-9]`를 사용했다.
- 원격 적용 전 pending migration을 다시 검토해 Data API grant, RLS, 복합 FK, `updated_at` trigger 계약을 추가했다.
- 원격 DB 적용 후 generated type을 만들고 browser/server/proxy Supabase helper에 `Database` 타입을 연결했다.
- SaaS 온보딩 관점에서 학원 생성 직후 owner 멤버십 삽입 전 `.insert().select()`가 막히는 RLS 틈을 계약 테스트로 추가하고 migration으로 보완했다.
- local reset/dump는 Docker daemon이 켜진 뒤 보조 검증으로 다시 실행한다.

## 남은 리스크

- 원격 DB에는 migration을 적용했지만, Docker daemon이 꺼져 있어 local reset과 schema dump 기반 검증은 아직 남아 있다.
- teacher가 출결을 직접 쓰는 정책, salary 본인 조회 정책, 데스크 재무/회차권 설정은 제품 정책 확정 후 RLS를 더 세분화해야 한다.
- `pnpm build`와 `pnpm test:e2e`에서 Supabase JS가 Node.js 22 이상을 권장한다는 경고가 표시된다. 현재 Node.js 20에서도 검증은 통과했지만 런타임 버전 정책을 정해야 한다.
