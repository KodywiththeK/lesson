# 2026-08-20 개인레슨 등록과 시간표 복사 증거

## 목표

PDF 1-2의 개인레슨표 요구사항 중 “원생 수강 악기 제한”, “같은 선생님/시간 중복 방지”, “원생/선생님 시간표 텍스트 복사” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `개인레슨표` 섹션
- `docs/product/acceptance-scenarios.md`의 `개인레슨 등록`, `시간표 복사` 섹션
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/private-lesson.test.ts`
- 시나리오:
  - 같은 학원, 같은 선생님의 시간이 겹치면 등록 차단
  - 다른 학원의 같은 선생님 식별자 일정은 충돌에서 제외
  - 취소된 개인레슨은 충돌에서 제외
  - 종료 시간이 시작 시간보다 빠르면 등록 차단
  - 원생이 같은 학원에서 활성 수강 중인 개인레슨 악기만 선택
  - 원생 시간표 복사용 텍스트 생성
  - 선생님 시간표 복사용 텍스트 생성
- 초기 실패: `private-lesson` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/private-lesson.ts`
  - `findPrivateLessonRegistrationBlocker`
  - `getSelectablePrivateLessonInstruments`
  - `formatPrivateLessonScheduleMessage`

## 정책 처리

- PDF에는 “같은 시간”으로 표현되어 있으나, 실제 운영에서는 시작 시간이 완전히 같지 않아도 시간이 겹치면 배정할 수 없으므로 시간 범위 overlap으로 해석했다.
- 다른 학원의 일정은 멀티테넌트 서비스 방향에 맞게 충돌 대상으로 보지 않는다.
- 취소된 개인레슨은 새 등록 가능 시간으로 본다.
- 문자 발송 API는 아직 붙이지 않고, PDF의 복사 흐름에 맞춰 메시지 텍스트 생성 규칙만 먼저 고정했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/private-lesson.test.ts` | 통과 | unit 7개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 27개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- UI 다이얼로그 구현 전에 충돌 판단과 선택지 필터링을 순수 도메인 함수로 분리했다.
- 시간표 복사 문자열은 사용자에게 보이는 결과를 테스트해, UI 구현 이후에도 회귀 방지 테스트로 유지할 수 있게 했다.
- 날짜/시간 표기는 ISO 문자열의 로컬 날짜/시간을 기준으로 만들며, 출력은 한국어 운영 메시지에 맞췄다.
- E2E 산출물과 build 산출물이 lint 대상에 섞이지 않도록 `eslint.config.mjs`에 ignore 규칙을 명시했다.
- 새 환경에서도 typecheck가 `.next` 생성 상태에 의존하지 않도록 `pnpm typecheck`에 `next typegen --webpack`을 포함했다.
- E2E 실행이 `next dev`로 `next-env.d.ts`를 흔들지 않도록 `pnpm test:e2e`는 production build 후 `next start`를 대상으로 실행한다.

## 남은 질문

- 개인레슨 기본 시간 단위는 30분, 50분, 60분 중 무엇을 기본값으로 둘지?
- 선생님이 직접 개인레슨을 등록할 수 있는지, 원장/데스크만 등록할 수 있는지?
- 향후 실제 문자/알림 발송 채널을 붙일지, 클립보드 복사만 유지할지?
