# 2026-08-20 개인레슨 등록 UI 모델 증거

## 목표

PDF 1-2 개인레슨 등록 UI 요구사항에 맞춰 등록 다이얼로그의 단계 순서와 원생 검색 결과 표시 정보를 도메인 모델로 고정한다.

## 출처 요구사항

- PDF 1-2: 개인레슨 등록 다이얼로그는 원생, 악기, 선생님, 시간 순서로 진행
- PDF 1-2: 개인레슨 원생 검색 결과는 잔여 회차와 최근 레슨 상태 표시
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/private-lesson.test.ts`
- 시나리오:
  - 등록 단계는 원생, 악기, 선생님, 시간 순서
  - 앞 단계가 완료되지 않은 단계는 잠금 상태
  - 원생 검색 결과에 악기별 잔여 회차 표시
  - 원생 검색 결과에 최근 개인레슨 날짜, 악기, 상태 라벨 표시
- 초기 실패: 등록 단계 상수와 검색 결과 빌더 함수가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/private-lesson.ts`
  - `PRIVATE_LESSON_REGISTRATION_STEPS`
  - `getPrivateLessonRegistrationFlowState`
  - `buildPrivateLessonStudentSearchResults`
  - 개인레슨 상태 라벨 매핑
- `docs/product/acceptance-scenarios.md`
  - 개인레슨 등록 UI와 검색 결과 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 개인레슨 등록 UI 요구사항 2개를 테스트와 구현 파일에 연결

## 정책 처리

- 등록 흐름은 원생 선택 전 악기, 선생님, 시간 단계가 잠기는 순차형 wizard로 정의했다.
- 원생 검색 결과는 현재 학원 범위 안에서만 구성해 멀티테넌트 서비스 방향을 유지했다.
- 최근 레슨은 `startAt` 기준 최신 개인레슨으로 계산하고, 상태는 사용자가 읽는 한국어 라벨로 함께 제공한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/private-lesson.test.ts` | 통과 | unit 9개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 92개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- UI wizard 순서를 문자열 분산 대신 상수로 고정해 향후 컴포넌트와 테스트가 같은 기준을 공유하게 했다.
- 검색 결과 표시 모델은 화면용 가공 로직이지만 학원 범위, 잔여 회차, 최근 레슨 상태라는 도메인 규칙을 한 곳에 모았다.
- 기존 충돌 검증, 악기 선택, 시간표 복사 규칙과 같은 `private-lesson` 도메인 안에 배치해 개인레슨 관련 규칙이 흩어지지 않게 했다.

## 남은 질문

- 최근 레슨 상태에서 취소 수업도 최신 상태로 보여줄지, 예정/출석/결석만 보여줄지?
- 검색 결과에 여러 악기의 잔여 회차를 모두 노출할지, 선택 가능한 개인레슨 악기만 노출할지?
