# 2026-08-21 월급제와 시급제 급여 증거

## 목표

PDF 3-2와 PDF 5 요구사항에 맞춰 월급제와 시급제 급여 유형의 조건부 필드와 계산 기준을 구현한다.

## 출처 요구사항

- PDF 3-2: 선생님 급여 형태 기록
- PDF 5: 월급제와 시급제 급여 계산
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/payroll.test.ts`
- 시나리오:
  - 월급제는 월 고정 급여에서 3.3% 원천징수 계산
  - 월급제는 1 이상의 월 고정 급여 필수
  - 시급제는 시급과 월 근무 시간으로 기본 급여 계산
  - 시급제는 1 이상의 시급과 0보다 큰 근무 시간 필수
- 초기 실패: `calculateMonthlyPayroll`, `calculateHourlyPayroll` 함수가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/payroll.ts`
  - `MonthlyPayrollPolicy`
  - `HourlyPayrollPolicy`
  - `calculateMonthlyPayroll`
  - `calculateHourlyPayroll`
  - `PayrollRecord.payType`을 `ratio | monthly | hourly`로 확장
- `docs/product/acceptance-scenarios.md`
  - 월급제와 시급제 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 급여 유형 요구사항을 테스트와 구현 파일에 연결

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/payroll.test.ts` | 통과 | unit 9개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 109개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 비율제, 월급제, 시급제가 같은 `PayrollRecord`와 지급 완료 ledger 흐름을 재사용하도록 했다.
- 원천징수 계산과 반올림 정책은 기존 비율제 규칙과 같은 함수를 사용한다.
- 급여 유형별 필수 입력은 계산 함수 경계에서 검증한다.

## 남은 질문

- 시급제 근무 시간은 수업 시간에서 자동 계산할지, 운영자가 월별로 입력할지?
- 월급제도 결근/휴원에 따른 공제 규칙이 필요한지?
