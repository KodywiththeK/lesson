# 2026-08-20 월별 메모 증거

## 목표

PDF 1-1 월별 메모 요구사항에 맞춰 학원과 월 기준 저장, 읽지 않음 표시, 새로고침 시 위치와 크기 초기화 규칙을 도메인 함수로 구현한다.

## 출처 요구사항

- PDF 1-1: 월별 메모 저장
- PDF 1-1: 읽지 않음 표시
- PDF 1-1: 새로고침 시 월별 메모 위치와 크기 초기화
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/monthly-memo.test.ts`
- 시나리오:
  - 학원과 월 기준으로 메모 저장
  - 다른 학원과 다른 월 메모는 유지
  - 같은 학원과 월을 다시 저장하면 내용 갱신 후 읽지 않음 표시
  - 읽음 처리 시 읽지 않음 표시 해제
  - 새로고침 후 패널 위치와 크기는 기본값으로 초기화
- 초기 실패: `src/domain/monthly-memo.ts`가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/monthly-memo.ts`
  - `saveMonthlyMemo`
  - `markMonthlyMemoRead`
  - `getInitialMonthlyMemoPanelState`
  - `DEFAULT_MONTHLY_MEMO_PANEL_STATE`
- `docs/product/acceptance-scenarios.md`
  - 월별 메모 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 월별 메모 요구사항을 테스트와 구현 파일에 연결

## 정책 처리

- 월별 메모는 멀티테넌트 방향에 맞춰 `academyId + month`를 저장 기준으로 삼았다.
- 메모를 새로 저장하거나 갱신하면 운영자가 확인해야 할 변경으로 보고 `unread: true`로 표시한다.
- 패널 위치와 크기는 영속 저장하지 않고 새로고침 때 기본값으로 되돌린다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/monthly-memo.test.ts` | 통과 | unit 4개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 90개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류와 경고 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 메모 저장은 배열을 mutation하지 않는 순수 upsert 함수로 유지했다.
- 같은 월 메모 갱신 시 기존 배열 위치를 유지해 목록 UI 연결 시 예측 가능하게 했다.
- 새로고침 초기화 규칙은 명시적인 함수로 분리해 UI state persistence를 추가할 때도 이 요구사항을 깨뜨리지 않도록 했다.

## 남은 질문

- 사용자가 직접 작성한 메모도 저장 직후 읽지 않음으로 표시하는 정책을 유지할지?
- 향후 여러 운영자가 동시에 보는 경우 읽음 상태를 학원 전체 기준으로 둘지, 사용자별로 둘지?
