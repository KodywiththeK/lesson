# 학원 수업 일별 출석 화면/API 연결 검증

## 목표

- PDF 1-1의 학원 피아노 레슨표 요구사항 중 날짜별 출석 확인 흐름을 실제 화면과 Supabase API 함수로 연결한다.
- 멀티학원 서비스 방향에 맞게 모든 query key와 Supabase 조회/저장은 `academyId`를 포함한다.

## TDD 기록

- Red:
  - `src/lib/api/academy-lessons.test.ts`
  - `src/features/academy-lessons/academy-lesson-attendance-screen.test.tsx`
  - `src/lib/api/query-keys.test.ts`
  - `src/app/lessons/page.test.tsx`
- Red 실패 확인:
  - `./academy-lessons` 모듈 없음
  - `./academy-lesson-attendance-screen` 컴포넌트 없음
  - `queryKeys.academyLessons.dailyAttendance` 없음
  - `/lessons` 페이지에 학원 출석 진입점 없음

## 구현

- `src/lib/api/academy-lessons.ts`
  - `lesson_events`에서 `academy_id`, `lesson_kind = academy`, `status = scheduled`, 선택 날짜의 KST day range로 일별 출석표 조회
  - `attendance_records`에 `academy_id, lesson_event_id, student_id` conflict 기준 upsert
  - Supabase `timestamptz`가 UTC로 반환되어도 `Asia/Seoul` 기준 날짜/시간으로 표시
- `src/features/academy-lessons/academy-lesson-attendance-screen.tsx`
  - shadcn `Dialog`, `Table`, `Badge`, `Button`, `Input` 기반 일별 출석 확인 UI
  - 전체 출석, 전체 결석, 원생별 출석, 원생별 결석 처리
  - TanStack Query로 조회/저장/무효화 연결
- `src/app/lessons/page.tsx`
  - 레슨 시간표 화면에 학원 피아노 출석 확인 섹션과 개인레슨 등록 섹션을 함께 노출

## 검증 결과

- `pnpm test:run`: 통과
  - 51 files, 202 tests
- `pnpm lint`: 통과
- `pnpm typecheck`: 통과
- `pnpm build`: 통과
- `pnpm test:e2e`: 통과
  - 8 tests

## 품질 정리

- 출석표 조회/저장 규칙은 UI가 아니라 `src/lib/api/academy-lessons.ts`에 분리했다.
- 시간대 변환을 API mapping 단계에 모아 Supabase 반환 형식 변화에 대한 UI 취약성을 줄였다.
- 테스트는 구현 세부 selector 대신 role, label, visible text 중심으로 유지했다.
- 공통 헤더의 `출석 확인` 버튼과 기능 섹션의 `출석 확인` 버튼이 공존하므로, 페이지/E2E 테스트는 `region` 기준으로 범위를 좁혔다.

## 남은 리스크

- 원격 Supabase DB에는 아직 migration을 적용하지 못했다. 현재 Codex 세션의 Supabase CLI가 `Access token not provided` 상태이므로, 원격 적용 전 `supabase login` 또는 `SUPABASE_ACCESS_TOKEN`/DB 접속 URL 세팅이 필요하다.
- 결석 사유 입력 UI는 아직 별도 필드 없이 기본값 `결석 확인`으로 저장한다. 운영 정책상 사유 필수 입력이 필요하면 다음 phase에서 다이얼로그 입력으로 확장한다.
- 빌드 중 `@supabase/supabase-js`가 Node.js 20 이하 지원 종료 예정 경고를 출력한다. 런타임은 Node.js 22 이상으로 올리는 것이 좋다.
