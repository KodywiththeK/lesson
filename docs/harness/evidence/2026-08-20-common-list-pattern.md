# 2026-08-20 공통 목록 패턴 증거

## 목표

PDF의 목록 공통 요구사항에 맞춰 업무 목록이 기본 10개 단위, 10/20/30 페이지 크기, 한글 이름 정렬, 검색과 필터를 일관되게 지원하도록 공통 도메인 로직과 운영 UI 툴바 패턴을 만든다.

## 출처 요구사항

- PDF 목록 공통 요구사항: 목록 기본 10개, 10/20/30 표시 개수, 가나다 정렬
- PDF 목록 공통 요구사항: 원생, 선생님, 거래처, 교재, 수입 내역의 검색 또는 필터
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/common-list.test.ts`
- 시나리오:
  - 페이지 크기는 10, 20, 30만 허용
  - 목록 기본값은 10개와 `ko-KR` 기준 이름 정렬
  - 지정 검색 필드로 검색
  - 선생님, 악기, 요일 같은 필터 적용
  - 페이지 번호와 페이지 크기별 결과 분리
- 초기 실패: `src/domain/common-list.ts`가 없어 테스트가 실패했다.

- 테스트 파일: `src/components/operations/list-toolbar.test.tsx`
- 시나리오:
  - 검색 입력과 10/20/30 페이지 크기 선택지를 제공
  - 필터 select를 접근 가능한 label과 option으로 렌더링
- 초기 실패: `src/components/operations/list-toolbar.tsx`가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/common-list.ts`
  - `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`, `normalizePageSize`
  - `buildListView`로 검색, 필터, 한글 정렬, pagination metadata 계산
- `src/components/operations/list-toolbar.tsx`
  - 운영 목록에서 재사용할 검색 입력, 필터 select, 페이지 크기 select
  - shadcn 토큰 기반 border/background/focus 스타일 사용
- `docs/product/acceptance-scenarios.md`
  - 공통 목록 인수 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 공통 목록 요구사항을 테스트와 구현 파일에 연결

## 정책 처리

- 목록 정렬은 `Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" })`로 고정했다.
- 페이지 크기는 PDF에 나온 10, 20, 30만 허용하고 잘못된 값은 기본 10으로 되돌린다.
- 엔티티별 검색/필터 필드는 공통 함수 호출부에서 지정하게 두어 원생, 선생님, 거래처, 교재, 수입 내역 화면이 같은 규칙을 재사용할 수 있게 했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/common-list.test.ts` | 통과 | unit 6개 테스트 통과 |
| `pnpm test:run src/components/operations/list-toolbar.test.tsx` | 통과 | component 2개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 79개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 목록 계산을 UI에서 분리해 도메인 순수 함수로 두었다.
- 테스트는 DOM 구조보다 사용자 관점의 searchbox/combobox role과 label을 기준으로 유지했다.
- 엔티티별 화면에서 복사될 가능성이 높은 검색/필터/page-size UI를 공통 컴포넌트로 분리했다.
- 과한 테이블 추상화는 만들지 않고, 현재 PDF 요구사항에서 반복이 확실한 toolbar와 list calculation만 공통화했다.

## 남은 질문

- 엔티티별 기본 정렬 기준이 이름이 아닌 경우가 있는지? 예: 수입 내역은 결제일 최신순이 더 자연스러울 수 있다.
- 거래처와 수입 내역의 필터 기본 세트는 실제 운영 정책 확정 후 화면 phase에서 정한다.
