# 2026-08-20 월별 고정 수입 snapshot과 수납/미납 증거

## 목표

PDF 5의 수입 관리 요구사항 중 “월별 고정 수입 snapshot”, “매월 미납 초기화”, “수납/미납 상태 관리”, “수납 완료 시 수입 ledger 반영” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `학원 고정 수입`, `입출입 내역`, `전체 수입` 섹션
- `docs/product/acceptance-scenarios.md`의 `수입 관리` 섹션
- `docs/product/traceability-matrix.md`
- `docs/product/open-questions.md`의 월 snapshot 경계 질문

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/tuition-income.test.ts`
- 시나리오:
  - 고정 수입 source로 월별 미납 snapshot 생성
  - 다른 학원, 비활성 source, 미래 시작 source 제외
  - 수납 완료 시 paid 상태와 수입 ledger 생성
  - 다른 학원의 수납 처리 거부
  - 미납 버튼으로 미납 목록 항목 생성
- 초기 실패: `tuition-income` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/tuition-income.ts`
  - `createMonthlyTuitionSnapshot`
  - `markTuitionAsPaid`
  - `markTuitionAsUnpaid`
  - 월별 수강료 record, 미납 항목, ledger 모델

## 정책 처리

- PDF의 “달 넘어가기 하루 전 00:00” 표현은 정확한 경계가 확인 필요이므로 자동 실행 시점은 구현하지 않았다.
- 도메인은 외부 스케줄러 또는 수동 액션이 특정 월을 넘겨 호출하는 순수 함수로 설계했다.
- 수납 ledger id는 `tuition:{tuitionId}`로 결정해 중복 반영 방지 기준으로 사용할 수 있게 했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/tuition-income.test.ts` | 통과 | unit 5개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 56개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 원생 등록 phase의 고정 수입 source를 월별 snapshot으로 이어 받을 수 있게 도메인 용어를 맞췄다.
- 수납 처리와 미납 목록 생성을 분리해 UI 액션과 ledger 반영이 명확하게 보이도록 했다.
- ledger 모델은 교재 판매 phase의 표준 ledger 타입을 재사용했다.

## 남은 질문

- 월별 snapshot 자동 생성 시점은 정확히 언제인지?
- 수납 취소 또는 부분 수납을 지원할지?
- 미납 목록에서 보호자 연락/알림 상태를 기록할지?
