# 2026-08-20 학원 수업 일별 출석 증거

## 목표

PDF 1-1 학원 피아노 레슨표 요구사항 중 날짜 선택 시 예상 출석 원생 표시, 일별 출석 모달의 개별/전체 출결 처리, 결석 인원 목록 이동과 확정 후 제거, 삭제 사유 기록을 도메인 규칙으로 구현한다.

## 출처 요구사항

- PDF 1-1: 날짜 선택 시 해당 날짜의 예상 출석 원생 표시
- PDF 1-1: 일별 출석 모달에서 원생별 출석/결석, 전체 출석, 전체 결석
- PDF 1-1: 결석 처리된 원생은 결석 인원 목록으로 이동하고 보강/패스 확정 후 제거
- PDF 1-1: 학원 수업 일정 삭제 시 사유 입력
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/academy-lesson-attendance.test.ts`
- 시나리오:
  - 선택 날짜와 학원 기준 예상 출석 원생 목록 생성
  - 개별 결석 처리와 결석 대기열 생성
  - 전체 출석 처리
  - 전체 결석 처리와 결석 대기열 이동
  - 보강 또는 패스 확정 후 결석 대기열 제거
- 초기 실패: `src/domain/academy-lesson-attendance.ts`가 없어 테스트가 실패했다.

- 테스트 파일: `src/domain/academy-lesson-schedule.test.ts`
- 시나리오:
  - 학원 수업 일정 삭제 시 사유와 처리 정보 기록
  - 삭제 사유가 비어 있으면 삭제 차단
- 초기 실패: `deleteAcademyLessonWithReason` 함수가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/academy-lesson-attendance.ts`
  - `buildDailyAcademyAttendance`
  - `markStudentAcademyLessonAttendance`
  - `markAllAcademyLessonAttendance`
  - `removeResolvedAbsenceFromQueue`
- `src/domain/academy-lesson-schedule.ts`
  - 삭제 상태와 삭제 감사 정보를 가진 `DeletedAcademyLessonEvent`
  - `deleteAcademyLessonWithReason`
- `docs/product/acceptance-scenarios.md`
  - 일별 출석 모달과 삭제 사유 시나리오 추가
- `docs/product/traceability-matrix.md`
  - PDF 1-1 미구현 항목 4개를 테스트와 구현 파일에 연결

## 정책 처리

- 일정 삭제는 실제 삭제가 아니라 `status: "deleted"`와 사유, 처리자, 처리 시각을 남기는 soft delete 결과로 정의했다.
- 삭제와 일별 출결 처리는 원생의 기본 반복 수업 요일을 변경하지 않는다.
- 결석 사유는 결석 대기열과 이후 보강/패스 확정 흐름의 출발점이므로 비어 있으면 차단한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/academy-lesson-attendance.test.ts` | 통과 | unit 5개 테스트 통과 |
| `pnpm test:run src/domain/academy-lesson-schedule.test.ts` | 통과 | unit 6개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 86개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 출석 상태 계산을 순수 함수로 분리해 이후 UI, Supabase action, TanStack Query mutation에서 같은 규칙을 사용할 수 있게 했다.
- 일별 목록은 학원 ID와 날짜 기준으로 필터링해 멀티테넌트 방향성을 유지했다.
- 결석 대기열은 출결 sheet의 파생 데이터로 만들고, 보강/패스 확정 후 제거 함수만 따로 제공해 UI 상태 관리가 단순해지도록 했다.
- 삭제는 감사 가능한 soft delete로 남겨 운영자가 사유를 추적할 수 있게 했다.

## 남은 질문

- 전체 결석의 기본 사유를 운영자가 매번 입력해야 하는지, 학원 휴강 템플릿을 둘지?
- 결석 대기열을 월별 메모와 즉시 연결할지, 보강/패스 확정 시점에만 메모를 생성할지?
