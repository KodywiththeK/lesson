# 2026-08-21 수동 입출입과 전체 수입 그래프 증거

## 목표

PDF 5 요구사항에 맞춰 권한 있는 사용자의 수동 수입/지출 입력과 연도/월 기준 전체 악기, 개별 악기, 학원 수입, 지출 비교 그래프 데이터를 구현한다.

## 출처 요구사항

- PDF 5: 원장 또는 허용된 데스크 직원은 수동 수입/지출 입력 가능
- PDF 5: 전체 수입 그래프는 연도/월 기준 전체 악기, 개별 악기, 학원 수입, 지출 비교 지원
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/finance-ledger.test.ts`
- 시나리오:
  - 권한 있는 사용자의 수동 수입/지출 입력
  - 권한 없는 사용자와 0 이하 금액 차단
  - 현재 학원 ledger만 월별 집계
  - 전체 악기 수입, 개별 악기 수입, 학원 수입, 지출, 순수입 계산
- 초기 실패: `src/domain/finance-ledger.ts`가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/finance-ledger.ts`
  - `createManualLedgerEntry`
  - `buildIncomeExpenseGraph`
  - 월별 그래프 포인트와 악기 breakdown 타입
- `docs/product/acceptance-scenarios.md`
  - 입출입 내역과 전체 수입 그래프 시나리오 추가
- `docs/product/traceability-matrix.md`
  - PDF 5 요구사항 2개를 테스트와 구현 파일에 연결

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/finance-ledger.test.ts` | 통과 | unit 3개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 105개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 수동 ledger 입력과 그래프 집계를 같은 재무 도메인에 두어 금액/권한/집계 규칙이 흩어지지 않게 했다.
- 그래프 집계는 `academyId`와 `year`로 scope를 제한해 멀티학원 데이터가 섞이지 않게 했다.
- 악기별 breakdown은 한글 이름 정렬로 안정적인 표시 순서를 가진다.

## 남은 질문

- “학원 수입”에 교재 판매 수입을 포함할지, 수강료 외 수동 수입만 포함할지?
- 그래프 UI는 월별 막대+누적 악기 breakdown으로 갈지, 탭으로 전체/악기별을 나눌지?
