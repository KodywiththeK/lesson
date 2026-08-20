# 2026-08-21 교재 구매 목록 증거

## 목표

PDF 4 교재 판매 UI 요구사항에 맞춰 교재 구매 목록이 원생, 교재명, 자동 입력 가격, 출고일을 표시하도록 구현한다.

## 출처 요구사항

- PDF 4: 교재 구매 목록은 원생, 교재명, 자동 입력 가격, 출고일 기록
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/book-sale.test.ts`
- 시나리오:
  - 현재 학원의 교재 판매만 표시
  - 원생명, 교재명, 자동 입력 가격, 출고일, 결제 상태 표시
  - 출고일과 원생명 기준 정렬
- 초기 실패: `buildBookPurchaseList` 함수가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/book-sale.ts`
  - `BookPurchaseListRow`
  - `buildBookPurchaseList`
- `docs/product/acceptance-scenarios.md`
  - 교재 판매 UI 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 교재 구매 목록 요구사항을 테스트와 구현 파일에 연결

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/book-sale.test.ts` | 통과 | unit 7개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 102개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 교재 가격은 출고 시 재고 가격에서 자동 입력된 `sale.price`를 목록에서 `autoFilledPrice`로 노출한다.
- 교재 판매 처리와 목록 표시 모델을 같은 도메인 안에 두어 가격 출처가 흩어지지 않게 했다.
- 멀티학원 서비스 방향에 맞춰 현재 학원 판매만 표시한다.

## 남은 질문

- 교재 구매 목록에서 결제 완료 내역까지 같은 표에 보여줄지, 결제 대기와 완료를 탭으로 분리할지?
