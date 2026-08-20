# 2026-08-20 회차권 수동 수정 권한 증거

## 목표

PDF 2 회차권 관리 요구사항에 맞춰 회차권 수동 수정은 권한 있는 역할만 수행하고, 수동 조정 사유와 감사 이벤트를 남기도록 구현한다.

## 출처 요구사항

- PDF 2: 회차권 수동 수정은 권한 있는 역할만 수행
- 사용자 추가 지시: 멀티학원 서비스 방향성과 민감 권한 분리
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/permissions.test.ts`
- 시나리오:
  - owner는 회차권 수동 수정 가능
  - desk는 기본 차단, `allowDeskTicketAdjustment` 설정이 있을 때 허용
  - teacher는 회차권 수동 수정 불가
- 초기 실패: `ticket-manual-adjustment` feature key와 플래그가 없어 테스트가 실패했다.

- 테스트 파일: `src/domain/lesson-ticket.test.ts`
- 시나리오:
  - 권한 있는 사용자는 사유와 함께 잔여 회수 조정
  - 권한 없으면 수동 수정 차단
  - 조정 후 잔여 회차가 음수가 되면 차단
- 초기 실패: `adjustLessonTicketManually` 함수가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/permissions.ts`
  - `ticket-manual-adjustment` feature key
  - `allowDeskTicketAdjustment` 설정 플래그
- `src/domain/lesson-ticket.ts`
  - `adjustLessonTicketManually`
  - `LessonTicketManualAdjustmentEvent`
- `docs/product/acceptance-scenarios.md`
  - 회차권 관리 권한 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 회차권 수동 수정 요구사항을 테스트와 구현 파일에 연결

## 정책 처리

- 회차권 수동 수정은 기본 owner 전용으로 두었다.
- 데스크 직원은 학원 설정에서 명시적으로 열리는 경우에만 수동 수정할 수 있다.
- 모든 수동 수정은 이전 잔여 회수, 변경 회수, 다음 잔여 회수, 사유, 처리자, 처리 시각을 이벤트로 남긴다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/permissions.test.ts` | 통과 | unit 9개 테스트 통과 |
| `pnpm test:run src/domain/lesson-ticket.test.ts` | 통과 | unit 14개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 96개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 민감 권한 판단은 `permissions` 도메인에 두고, 회차권 잔여 회수 계산은 `lesson-ticket` 도메인에 남겨 책임을 분리했다.
- 수동 수정 함수는 잔여 회차 하한, 사유 필수, 학원 범위 확인을 모두 수행한다.
- 데스크 권한을 feature flag로 둬 학원별 운영 정책을 나중에 설정화하기 쉽게 했다.

## 남은 질문

- 데스크 회차권 수동 수정 권한을 UI 설정에서 학원별로 노출할지?
- 수동 수정 사유를 자유 입력으로 둘지, 선택 사유 템플릿과 자유 메모를 함께 둘지?
