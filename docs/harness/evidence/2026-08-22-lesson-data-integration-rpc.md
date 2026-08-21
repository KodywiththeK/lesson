# 레슨 데이터 연동 RPC 적용 증거

## 목표

- 개인레슨 출석 처리와 회차권 차감을 Supabase RPC 하나로 원자 처리한다.
- 학원 정기 레슨은 월간 레슨관리표/일별 출석표 조회 전에 `student_instruments` 기준으로 누락 일정을 생성한다.
- UI는 RPC 성공 후에만 개인레슨 출결 상태와 성공 토스트를 반영한다.

## 구현 요약

- `mark_private_lesson_attendance` RPC를 추가했다.
  - 개인레슨 출석 기록 upsert, 회차권 1회 차감, 사용 이력 생성을 같은 트랜잭션에서 처리한다.
  - 같은 개인레슨을 다시 출석 처리해도 unique 사용 이력과 row lock으로 중복 차감하지 않는다.
  - 출석에서 결석으로 바뀌면 사용 이력을 삭제하고 회차권 잔여를 1회 복구한다.
- `ensure_monthly_academy_lesson_events` RPC를 추가했다.
  - `student_instruments.weekdays/start_time/end_time/teacher_id`를 기준으로 조회 월의 학원 레슨 이벤트를 생성한다.
  - `lesson_events_generated_enrollment_unique_idx`로 같은 월 반복 일정 중복 생성을 막는다.
- `fetchLessonWorkspaceData`, `fetchDailyAcademyLessonAttendance`가 조회 전에 정기 일정 생성 RPC를 호출하도록 수정했다.
- 개인레슨 출결 UI는 mutation 성공 후에만 상태 override, query invalidation, 성공 toast를 실행하도록 수정했다.

## 원격 검증

- 대상 프로젝트: 연결된 Supabase 원격 프로젝트 `zkzqmqtzzlgljkuctpbn`
- 계정: `owner@lesson.local`
- 정기 일정 생성:
  - 2026-08 학원 레슨 이벤트 수: `3 -> 22`
  - RPC 반환 생성 수: `19`
- 개인레슨 회차권 연동:
  - 기준 결석 상태: 한서아 바이올린 회차권 `2회`, 사용 이력 `0`
  - 1회 출석 처리 후: 잔여 `1회`, 사용 이력 `1`
  - 같은 레슨 중복 출석 처리 후: 잔여 `1회`, 사용 이력 `1`
  - 결석 전환 후: 잔여 `2회`, 사용 이력 `0`
  - 최종 출석 상태로 복귀: 잔여 `1회`, 사용 이력 `1`, 출결 `present`

## 실행한 검증 명령

- `pnpm test:run src/lib/api/private-lessons.test.ts src/lib/api/lesson-workspace.test.ts src/lib/api/academy-lessons.test.ts src/lib/supabase/schema-contract.test.ts --reporter=dot`
  - 통과: 4 files, 28 tests
- `pnpm test:run --reporter=dot`
  - 통과: 55 files, 235 tests
- `pnpm lint`
  - 통과
- `pnpm typecheck`
  - 통과
- `pnpm build`
  - 통과
- `pnpm test:e2e`
  - 통과: 8 tests
- `supabase db push --dry-run --linked`
  - 적용 대상 migration 확인 후 통과
- `supabase db push --linked --yes`
  - 원격 적용 완료
- `supabase db lint --linked --fail-on error`
  - 통과: No schema errors found

## 남은 리스크

- 로컬 Node.js 20에서 최신 `@supabase/supabase-js`가 WebSocket transport 경고/오류를 낼 수 있다. 앱 build/E2E는 통과했지만, CLI 검증 스크립트는 REST/RPC 직접 호출 방식으로 검증했다. 추후 로컬/배포 Node 런타임을 Node 22 이상으로 고정하는 작업이 필요하다.
