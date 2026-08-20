# 2026-08-20 비율제 급여와 지급 ledger 증거

## 목표

PDF 5의 급여 지급 요구사항 중 “비율제 급여 계산”, “3.3% 원천징수 반영”, “급여 지급 시 지출 ledger 생성” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `선생님`, `선생님 월급`, `입출입 내역` 섹션
- `docs/product/acceptance-scenarios.md`의 `급여 지급` 섹션
- `docs/product/traceability-matrix.md`
- `docs/product/open-questions.md`의 급여 반올림/절사 질문

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/payroll.test.ts`
- 시나리오:
  - 완료 수업 수강료와 선생님 비율로 기본 급여 계산
  - 다른 학원, 다른 선생님, 다른 월 수업 제외
  - 원천징수 원 단위 처리 정책 적용
  - 급여 지급 확정 시 지출 ledger 생성
  - 이미 지급 완료된 급여의 중복 지급 거부
- 초기 실패: `payroll` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/payroll.ts`
  - `calculateRatioPayroll`
  - `markPayrollAsPaid`
  - 비율제 급여 정책, 완료 수업 수입, 급여 record, 지출 ledger 모델

## 정책 처리

- PDF의 3.3% 원천징수는 `withholdingTaxRate: 0.033` 입력값으로 반영한다.
- 원 단위 반올림/절사 정책은 확인 필요이므로 `rounding` 옵션으로 받는다.
- 급여 지급 ledger id는 `payroll:{payrollId}`로 결정해 중복 반영 방지 기준으로 사용할 수 있게 했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/payroll.test.ts` | 통과 | unit 5개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 61개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 급여 계산과 지급 확정을 분리해 계산 검토 후 지급하는 운영 흐름을 표현했다.
- 수입/지출 ledger는 교재/수강료와 같은 표준 타입을 사용해 전체 수입 계산으로 이어질 수 있게 했다.
- 멀티테넌트, 선생님, 월 범위 필터를 계산 첫 단계에 적용했다.

## 남은 질문

- 비율제 외 월급제/시급제 계산 상세 정책은 어떻게 둘지?
- 원천징수 원 단위 처리의 기본 정책은 반올림, 올림, 내림 중 무엇인지?
- 지급 완료 후 수정/취소 가능 여부와 audit 사유 정책은 무엇인지?
