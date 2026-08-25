# 2026-08-25 레슨 시간표 학원레슨 일별 출결 개선

## 변경 내용

- 학원레슨 탭을 월간 캘린더와 선택 일자 테이블 구조로 정리했다.
- 캘린더 날짜 클릭 다이얼로그를 검색, 상태 필터, 전체/선택 출결 처리, 선택 초기화, 일정 이동을 포함한 대형 출결 작업 다이얼로그로 확장했다.
- 미등원인원 다이얼로그를 선택 날짜가 아닌 선택 월 전체 기준으로 변경했다.
- 캘린더/테이블 옆에 메모 리마인더 패널을 추가하고, 캘린더 셀의 메모 표시를 유지했다.
- 학원 레슨 1회 일정 이동과 출결 초기화를 Supabase RPC로 추가했다.

## Red 기록

- `pnpm test:run src/lib/api/lesson-workspace.test.ts --reporter=dot`
  - `moveAcademyLessonEvent`, `resetAcademyLessonAttendance` 미구현으로 실패 확인.
- `pnpm test:run src/lib/supabase/schema-contract.test.ts --reporter=dot`
  - 새 RPC와 `rescheduled` origin migration 미존재로 실패 확인.
- `pnpm test:run src/features/lessons/lesson-management-workspace.test.tsx --reporter=dot`
  - 일별 테이블, 출결 검색/일괄 처리/초기화, 일정 이동, 월간 미등원, 메모 리마인더 미구현으로 실패 확인.

## 최종 검증

- `pnpm test:run --reporter=dot`
  - 58 files, 286 tests passed.
- `pnpm lint`
  - 통과.
- `pnpm typecheck`
  - 통과.
- `pnpm build`
  - 통과.
- `pnpm test:e2e`
  - 9 tests passed.
- `supabase db push --linked --dry-run`
  - `20260825083011_lesson_attendance_day_workflow.sql` 1개 migration 적용 대상 확인.
- `supabase db push --linked`
  - 원격 DB 적용 완료.
- `supabase db lint --linked --fail-on error`
  - No schema errors found.
- `supabase migration list --linked`
  - local/remote 모두 `20260825083011` 적용 확인.

## 원격 Supabase 검증

- 테스트 계정으로 로그인 후 새 RPC를 호출했다.
- 존재하지 않는 일정 ID를 사용했을 때 `move_academy_lesson_event`는 `이동할 학원 일정을 찾지 못했습니다.`, `reset_academy_lesson_attendance`는 `출결 초기화할 학원 일정을 찾지 못했습니다.`를 반환했다.
- 이는 함수가 원격 DB에 배포되어 권한 검사를 통과한 뒤 도메인 검증까지 도달함을 확인한다.

## Quality Consolidation

- 출결 저장 로직을 `markAcademyAttendanceRows`로 모아 개별/전체/선택/미등원 출석 처리가 같은 경로를 타도록 정리했다.
- 출결 초기화와 일정 이동은 화면에서 직접 테이블을 조작하지 않고 RPC/API 함수로 분리했다.
- demo 상태 업데이트도 실제 API 의미와 맞게 원본 일정 제거, 이동 일정 추가, 출결 초기화를 동일한 시트 헬퍼로 처리하게 정리했다.
- 테스트는 구현 세부 클래스보다 role, label, 사용자에게 보이는 텍스트 중심으로 작성했다.

## 남은 위험

- Supabase JS가 Node.js 20 이하 지원 종료 경고를 출력한다. 개발/배포 런타임을 Node.js 22 이상으로 올리는 후속 작업이 필요하다.
- 보강 처리된 결석의 초기화는 데이터 정합성상 막아두었다. 보강 취소/되돌리기는 별도 기능으로 설계해야 한다.
