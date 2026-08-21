# PostgREST 관계 조회 오류 수정

## 문제

- 레슨관리표에서 다음 오류가 발생했다.
  - `개인레슨 원생 선택지를 불러오지 못했습니다: Could not embed because more than one relationship was found for 'students' and 'student_instruments'`
- 원인은 테넌트 무결성을 위해 단일 FK와 복합 FK를 함께 둔 테이블 사이에서 PostgREST embed 관계가 2개 이상 발견됐기 때문이다.

## 변경

- PostgREST select 문자열에 명시적 관계명을 추가했다.
  - `students!lesson_events_academy_student_fk(...)`
  - `teachers!lesson_events_academy_teacher_fk(...)`
  - `attendance_records!attendance_records_academy_lesson_event_fk(...)`
  - `student_instruments!student_instruments_academy_student_fk(...)`
  - `teachers!student_instruments_academy_teacher_fk(...)`
  - `students!lesson_ticket_grants_academy_student_fk(...)`
- 적용 API
  - 원생 목록
  - 회차권 목록/등록 선택지
  - 개인레슨 등록 선택지/개인레슨 일정 반환
  - 레슨관리표 월간 이벤트
  - 학원 수업 출석표

## 원격 API 검증

`owner@lesson.local` 세션으로 원격 Supabase REST API를 직접 호출했다.

- 현재 학원: 200, 1 row
- 원생: 200, 5 rows
- 선생님: 200, 3 rows
- 회차권: 200, 2 rows
- 개인레슨 선택지: 200, 5 rows
- 레슨관리표 이벤트: 200, 5 rows
- 거래처: 200, 2 rows
- 교재: 200, 2 rows
- 수입/지출: 200, 4 rows

## 자동 검증

- `pnpm test:run src/lib/api/students.test.ts src/lib/api/private-lessons.test.ts src/lib/api/lesson-tickets.test.ts src/lib/api/academy-lessons.test.ts --reporter=dot`
  - 4 files / 17 tests passed.
- `pnpm test:run --reporter=dot`
  - 54 files / 228 tests passed.
- `pnpm lint`
  - 통과.
- `pnpm typecheck`
  - 통과.
- `pnpm build`
  - 통과.
- `pnpm test:e2e`
  - 8 passed.

## 남은 주의점

- build와 E2E build 단계에서 Node.js 20의 `@supabase/supabase-js` 향후 지원 중단 경고가 출력된다. 이후 Node.js 22 업그레이드가 필요하다.
- 이번 수정은 schema 변경 없이 PostgREST select 관계명만 명시한 변경이다.
