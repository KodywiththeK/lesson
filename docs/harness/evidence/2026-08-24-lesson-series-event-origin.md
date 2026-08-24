# 2026-08-24 레슨 일정 series/event 분리 및 보강/비정기 API 연결

## 목표

- 레슨 캘린더를 정기, 비정기, 보강, 개인레슨까지 견디는 event 중심 구조로 재설계한다.
- 정기 반복 규칙은 `lesson_series`로 분리하고, 실제 캘린더 표시는 `lesson_events`를 기준으로 통합한다.
- 원생 정기 수업 정보 수정은 적용일 이후 일정만 바뀌도록 DB RPC로 원자 처리한다.

## 변경 내용

- `lesson_series` 테이블을 추가했다.
  - 반복 요일, 시작/종료 시간, 담당 선생님, 효력 시작/종료일, `superseded_by`를 저장한다.
  - RLS, authenticated grant, updated_at trigger, tenant composite FK를 포함했다.
- `lesson_events`에 `series_id`, `origin`, `source_lesson_event_id`, `counts_for_ticket`, `creation_reason`을 추가했다.
- `ensure_monthly_academy_lesson_events`를 `student_instruments`가 아니라 `lesson_series` 기준 materialize로 교체했다.
- `update_student_profile_from_date` RPC를 추가했다.
  - 원생명과 수강 정보를 수정한다.
  - 기존 정기 series를 적용일 전날로 닫고 새 series를 만든다.
  - 적용일 이후 출석 기록이 없는 scheduled 정기 event만 `cancelled` 처리한다.
- `create_makeup_lesson_event` RPC를 추가했다.
  - 원본 결석 수업, 보강 event, `absence_resolutions`를 transaction으로 함께 저장한다.
- 학원 레슨표에 “일정 추가” 다이얼로그를 추가했다.
  - 비정기/특강 학원 일정을 `lesson_events`에 직접 생성한다.
- 날짜 출석 다이얼로그와 캘린더/테이블에 정기, 비정기, 보강, 개인레슨 출처 배지를 표시한다.

## Red

- 스키마 계약 테스트에 `lesson_series`, event origin 필드, series 기반 정기 생성, 원생 수정 RPC, 보강 RPC 조건을 먼저 추가했다.
- API 테스트에 비정기 학원 일정 직접 생성과 보강 RPC 위임 테스트를 추가했다.
- UI 테스트에 비정기 일정 추가와 보강 일정 캘린더 표시 시나리오를 추가했다.

## Green / Refactor

- 테스트가 요구하는 새 API와 UI를 구현했다.
- 실제 API 모드에서 보강 저장 실패 시 가짜 보강 일정이 화면에 남지 않도록 낙관 업데이트를 제거했다.
- 보강 row 생성 로직을 `toMakeupAttendanceRow`로 분리했다.
- 개인레슨 event는 `origin = private`, `counts_for_ticket = true`를 명시하도록 정리했다.

## 검증

- `pnpm test:run src/lib/api/students.test.ts src/lib/api/lesson-workspace.test.ts src/lib/api/private-lessons.test.ts src/features/lessons/lesson-management-workspace.test.tsx --reporter=dot`: 통과
- `pnpm test:run src/lib/supabase/schema-contract.test.ts --reporter=dot`: 통과
- `pnpm lint`: 통과
- `pnpm typecheck`: 통과
- `pnpm test:run --reporter=dot`: 56 files, 254 tests 통과
- `pnpm build`: 통과
- `pnpm test:e2e`: 8 tests 통과
- `supabase db push --dry-run --linked`: 적용 대상 migration 확인
- `supabase db push --linked --yes`: 원격 DB migration 적용 완료
- `supabase db lint --linked --fail-on error`: `No schema errors found`
- 원격 Supabase REST/Auth/RPC 검증:
  - `owner@lesson.local` 로그인 성공
  - `lesson_series` 조회 성공
  - `ensure_monthly_academy_lesson_events` 호출 성공
  - `lesson_events`에서 `origin`, `series_id`, `counts_for_ticket` 응답 확인
- `curl -I http://127.0.0.1:3000/lessons`: `HTTP/1.1 200 OK`

## 남은 위험

- 현재 Node.js가 v20.13.1이라 `@supabase/supabase-js`가 Node 22 이상 권장 경고를 출력한다. 브라우저 동작에는 즉시 영향이 없지만 개발/CI 런타임은 Node 22로 올리는 것이 좋다.
- 충돌 정책은 아직 “강한 경고 후 저장 가능” UI까지 구현하지 않았다. 이번 phase에서는 DB 구조와 일정 추가/보강 저장 경로를 먼저 연결했다.
- 취소 이력 전용 화면은 아직 없다. `status = cancelled`와 사유는 저장되므로 이후 운영 이력 UI를 붙일 수 있다.
