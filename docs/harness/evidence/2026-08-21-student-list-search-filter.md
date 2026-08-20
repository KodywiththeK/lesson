# 2026-08-21 원생 목록 검색 필터 증거

## 목표

PDF 3-1 원생 목록 요구사항에 맞춰 원생 목록이 현재 학원 범위 안에서 이름, 선생님, 악기, 정기 요일 기준 검색과 필터, 이름 정렬을 지원하도록 구현한다.

## 출처 요구사항

- PDF 3-1: 원생 목록은 이름, 선생님, 악기, 정기 요일 기준 검색/정렬 지원
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/student-list.test.ts`
- 시나리오:
  - 현재 학원 원생만 이름 가나다순 표시
  - 이름, 선생님, 악기, 정기 요일 검색
  - 선생님, 악기, 정기 요일 필터 동시 적용
- 초기 실패: `src/domain/student-list.ts`가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/student-list.ts`
  - `StudentListRow`
  - `buildStudentList`
  - 원생 목록 전용 검색/필터 어댑터
- `docs/product/acceptance-scenarios.md`
  - 원생 목록 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 원생 목록 요구사항을 테스트와 구현 파일에 연결

## 정책 처리

- 공통 목록 규칙의 페이지 크기, 한글 이름 정렬, pagination metadata를 재사용했다.
- 원생 목록 검색 필드는 PDF 용어에 맞춰 이름, 담당 선생님, 악기, 정기 요일로 고정했다.
- 멀티학원 서비스 방향에 맞춰 `academyId`로 먼저 범위를 제한한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/student-list.test.ts` | 통과 | unit 3개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 99개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 공통 목록 함수는 그대로 재사용하되, 배열 필드 검색과 필터는 원생 목록 어댑터에서 명시적으로 처리했다.
- UI 화면을 만들기 전에도 원생 목록의 검색/필터 계약을 순수 함수로 고정했다.
- 검색과 필터는 구현 세부가 아니라 PDF 사용자 행동 기준으로 테스트했다.

## 남은 질문

- 정렬 기준을 이름 고정으로 둘지, 담당 선생님/악기/요일 컬럼 정렬도 화면에서 추가할지?
