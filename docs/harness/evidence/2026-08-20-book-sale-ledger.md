# 2026-08-20 교재 판매와 수입 ledger 증거

## 목표

PDF 4의 교재 관리 요구사항 중 “교재 등록”, “출고 시 재고 감소와 결제 대기”, “결제 완료 시 영구 판매 기록과 수입 ledger 반영” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `교재 관리`, `입출입 내역` 섹션
- `docs/product/acceptance-scenarios.md`의 `교재 판매` 섹션
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/book-sale.test.ts`
- 시나리오:
  - 교재명, 가격, 수량, 입고일로 재고 기록 생성
  - 출고 시 재고 1 감소와 결제 대기 판매 생성
  - 재고가 0이 되어도 재고 기록 유지
  - 다른 학원의 재고는 출고 거부
  - 결제 완료 시 판매 확정 기록과 수입 ledger 생성
  - 이미 결제 완료된 판매의 중복 완료 거부
- 초기 실패: `book-sale` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/book-sale.ts`
  - `registerBookStock`
  - `shipBookToStudent`
  - `completeBookSalePayment`
  - 교재 재고, 판매, 수입 ledger 모델

## 정책 처리

- 교재 결제 완료 기록은 `permanent: true`로 표시해 영구 판매 기록이라는 PDF 요구를 계약으로 남겼다.
- 실제 삭제 권한/불변성 enforcement는 향후 권한/RLS phase에서 다룬다.
- ledger id는 `book-sale:{saleId}`로 결정해 중복 반영 방지 기준으로 사용할 수 있게 했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/book-sale.test.ts` | 통과 | unit 6개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 51개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 교재 재고, 판매, ledger를 분리해 향후 DB transaction 저장 단위를 명확히 했다.
- 멀티테넌트 학원 범위 불일치를 도메인 함수에서 먼저 차단했다.
- 판매 완료 후 ledger가 전체 수입 계산의 source of truth가 될 수 있도록 표준 항목 형태로 반환했다.

## 남은 질문

- 결제 완료 교재 판매 기록을 UI에서 수정/삭제할 수 있는 권한은 누구에게 줄지?
- 교재 반품/환불 흐름이 필요한지?
- 교재 판매 결제 수단을 기록할지?
