# 2026-08-20 회차권 재등록과 상태 표시 증거

## 목표

PDF 2장 회차권 요구사항 중 “같은 원생/악기의 기존 회차권에 회수와 기간을 추가한다”와 “잔여 부족/만료 임박을 표시한다” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `회차권` 섹션
- `docs/product/acceptance-scenarios.md`의 `회차권 재등록과 상태 표시` 섹션
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/lesson-ticket.test.ts`
- 시나리오:
  - 같은 학원, 원생, 악기의 활성 회차권에 회수와 유효기간 추가
  - 기존 활성 회차권이 없으면 새 회차권 생성
  - 다른 학원 회차권에는 재등록 병합 거부
  - 잔여 부족 상태 표시
  - 만료 임박 상태 표시
  - 만료/소진 상태 표시
- 초기 실패: `registerLessonTicket`, `summarizeLessonTicketStatus` 함수가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/lesson-ticket.ts`
  - `LessonTicket`
  - `LessonTicketRegistration`
  - `registerLessonTicket`
  - `summarizeLessonTicketStatus`

## 정책 처리

- 회차권 만료 임박 기준과 잔여 부족 기준은 학원별 정책이 될 수 있으므로 하드코딩하지 않았다.
- `summarizeLessonTicketStatus`는 `lowRemainingThreshold`, `expiringWithinDays`를 외부 옵션으로 받는다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run` | 통과 | unit/component 20개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 회차권 재등록과 상태 표시는 UI나 Supabase에 묶지 않고 순수 도메인 함수로 분리했다.
- 멀티테넌트 사고를 막기 위해 학원, 원생, 악기 scope 불일치를 함수 레벨에서 거부한다.
- 날짜 계산은 `YYYY-MM-DD`를 UTC day number로 변환해 시간대에 따른 흔들림을 줄였다.

## 남은 질문

- 실제 기본 잔여 부족 기준은 몇 회 이하인지?
- 실제 기본 만료 임박 기준은 며칠 이내인지?
- 회차권 수동 수정/차감 취소 권한과 audit 사유 정책은 이후 권한 phase에서 확인이 필요하다.
