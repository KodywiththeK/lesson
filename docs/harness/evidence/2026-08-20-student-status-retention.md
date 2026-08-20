# 2026-08-20 원생 휴원/퇴원 상태 전환과 보관 증거

## 목표

PDF 3-3의 휴원/퇴원 관리 요구사항 중 “상태 이동 시 확인 절차”, “휴원/퇴원/재원 처리”, “퇴원 30일 보관 후 삭제 가능 상태 표시” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `휴원/퇴원 원생` 섹션
- `docs/product/acceptance-scenarios.md`의 `원생 상태 전환`, `원생 보관 정책` 섹션
- `docs/product/traceability-matrix.md`
- `docs/product/open-questions.md`의 데이터 보관 질문

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/student-status.test.ts`
- 시나리오:
  - 재원 원생을 휴원으로 전환할 때 확인 절차 요구
  - 휴원 원생을 재원으로 복구할 때 확인 절차 요구
  - 휴원 원생을 퇴원으로 전환하면 퇴원일 기록
  - 퇴원 원생을 휴원으로 직접 전환할 수 없음
  - 퇴원 후 30일 보관 만료일과 남은 일수 계산
  - 보관 기간이 지나면 삭제 가능 상태만 표시
- 초기 실패: `student-status` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/student-status.ts`
  - `transitionStudentStatus`
  - `calculateWithdrawnStudentRetention`
  - 원생 상태, 상태 전환 이벤트, 보관 만료 모델

## 정책 처리

- 상태 전환 결과에는 항상 `confirmationRequired: true`를 포함해 UI 확인 다이얼로그 요구를 계약으로 노출했다.
- 퇴원 30일 후에는 `canDelete: true` 상태만 계산하고, hard delete/archive 실행 방식은 구현하지 않았다.
- 보관 기간은 함수 옵션으로 받아 향후 학원별 정책 또는 제품 정책 변경에 대응할 수 있게 했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/student-status.test.ts` | 통과 | unit 6개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 40개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 상태 전환 규칙과 보관 만료 계산을 UI 목록 이동과 분리했다.
- 실제 삭제 방식은 질문 목록에 남겨두고, 삭제 가능 상태만 계산해 추측 구현을 피했다.
- 날짜 계산은 UTC day number 기반으로 처리해 시간대 흔들림을 줄였다.

## 남은 질문

- 퇴원 30일 후 실제 처리는 hard delete, soft delete, archive 중 무엇으로 할지?
- 삭제 가능 상태가 되기 전에 원장에게 알림을 보낼지?
- 휴원/퇴원/재원 처리 사유를 필수로 강제할지?
