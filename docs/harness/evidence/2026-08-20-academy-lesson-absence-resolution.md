# 2026-08-20 학원 수업 결석 보강/패스 증거

## 목표

PDF 1-1 시나리오 B의 학원 수업 결석 처리 요구사항 중 “보강 일정 생성”, “패스 기록”, “월별 메모 기록”, “결석 확정 시 회차권 미차감” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `결석, 보강, 패스` 섹션
- `docs/product/acceptance-scenarios.md`의 `학원 수업 보강` 섹션
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/academy-lesson-absence.test.ts`
- 시나리오:
  - 보강으로 확정하면 `[보강 수업]` 일정과 월별 메모 생성
  - 보강 날짜가 없으면 보강 확정 거부
  - 패스로 확정하면 보강 일정 없이 패스 메모만 생성
  - 보강/패스 확정 결과에는 회차권 차감 기록이 없음
- 초기 실패: `academy-lesson-absence` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/academy-lesson-absence.ts`
  - `resolveAcademyLessonAbsence`
  - 보강 일정 모델
  - 월별 메모 모델
  - 결석 확정 결과 모델

## 정책 처리

- 월별 메모의 기준 월은 원래 결석일의 월로 기록했다.
- 보강 시간은 선택 입력으로 처리하고, 보강 날짜는 필수로 검증한다.
- 결석 확정은 출석 확정과 별도 흐름이므로 회차권 사용 기록을 만들지 않는다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/academy-lesson-absence.test.ts` | 통과 | unit 3개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 30개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 회차권 차감 함수와 결석 확정 함수를 분리해 “출석만 차감” 규칙을 유지했다.
- 보강 일정 제목과 메모 문자열은 사용자가 보는 결과를 기준으로 테스트했다.
- 향후 Supabase 저장 시에도 `resolvedAbsence`, `makeupLesson`, `monthlyMemo`를 각각 transaction 단위로 저장할 수 있도록 결과를 구조화했다.

## 남은 질문

- 월별 메모 기준 월을 원래 결석일 월로 고정할지, 보강일 월에도 중복 표시할지?
- 보강 일정의 기본 시간 길이와 선생님 배정 정책은 무엇으로 할지?
- 결석 확정 취소 또는 보강 일정 변경 시 audit 사유를 필수로 받을지?
