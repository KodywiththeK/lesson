# 2026-08-20 학원 피아노 반복 일정과 월내 이동 증거

## 목표

PDF 1-1의 학원 피아노 레슨표 요구사항 중 “원생 등록 정보 기반 반복 일정 생성”과 “드래그 이동은 해당 월에만 반영되고 원생 기본 요일은 바뀌지 않음” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `학원 피아노 레슨표` 섹션
- `docs/product/acceptance-scenarios.md`의 `학원 피아노 레슨표` 섹션
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/academy-lesson-schedule.test.ts`
- 시나리오:
  - 학원 수업 요일을 기준으로 해당 월의 반복 일정 생성
  - 다른 학원, 비활성 수강, 개인레슨 수강 정보 제외
  - 같은 월 안에서 일정 날짜와 시간만 이동
  - 다른 월로 이동 시 거부
- 초기 실패: `academy-lesson-schedule` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/academy-lesson-schedule.ts`
  - `generateAcademyLessonEvents`
  - `moveAcademyLessonWithinMonth`
  - 요일, 학원 수업 수강, 월별 표시 이벤트 모델

## 정책 처리

- 반복 일정은 현재 학원의 활성 학원 수업 수강 정보만 포함한다.
- 개인레슨 수강 정보는 학원 피아노 레슨표 생성에서 제외한다.
- 드래그 이동은 표시 이벤트를 override하는 성격으로 처리하고, 원생 기본 수업 요일은 변경하지 않는다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/academy-lesson-schedule.test.ts` | 통과 | unit 4개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 34개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 월별 표시 이벤트 생성을 UI calendar와 분리해, 향후 DB fixture와 E2E seed에 재사용할 수 있게 했다.
- 멀티테넌트 필터를 함수 첫 단계에 두어 다른 학원 원생 일정이 섞이지 않게 했다.
- 이동 결과에 `enrollmentScheduleChanged: false`를 명시해 기본 수강 요일을 바꾸지 않는 규칙을 테스트 가능한 계약으로 만들었다.

## 남은 질문

- 학원 피아노 수업의 기본 시간 길이는 학원별 설정으로 둘지, 악기/반별 설정으로 둘지?
- 공휴일 또는 학원 휴무일에는 반복 일정을 자동 제외할지?
- 같은 시간대에 여러 원생이 있는 학원 수업에서 정원 제한을 둘지?
