# UI 디자인 시스템 정비 3단계: 공용 컴포넌트 추출

## 요약

- 목표: 화면마다 복붙된 카드·제목 헤더·요약 값·빈 안내 문구를 `src/components/shared/`의 공용 부품으로 모은다. 로직은 건드리지 않는 스타일 전용 작업이다.
- 계획: `~/.claude/plans/valiant-puzzling-cosmos.md`의 3단계. 이전 단계는 [1단계](./2026-10-21-ui-redesign-stage1-tokens.md), [2단계](./2026-10-21-ui-redesign-stage2-app-shell.md)다.
- 이 단계에서는 부품을 만들고 수입(finance) 화면 5곳에 먼저 적용해 맞는지 검증했다. 나머지 화면 전체 전환은 4단계다.

## 변경 내용

- 새 부품 (`src/components/shared/`)
  - `section-card.tsx`: `SectionCard`(shadcn `Card`의 기본 여백을 걷어 낸 흰 카드, `padded` 선택), `SectionHeader`(제목 h2 + 설명 + 작업 영역, `as="h3"` 지원).
  - `stat-tile.tsx`: `StatFigure`(라벨 + 큰 값, `emphasized` 선택), `StatTile`(카드로 감싼 `StatFigure`).
  - `empty-state.tsx`: `EmptyState`(shadcn `Empty` 기반 안내 문구, 접근성 속성 전달). 로딩 문구도 같은 모양이라 `LoadingState`는 따로 만들지 않았다.
- 첫 적용 (수입 화면)
  - `finance-shared.tsx`: `FinanceMonthSummary`와 `FinanceListSearch`의 카드를 `SectionCard`/`StatFigure`로 바꿨고, 같은 역할이던 `EmptyListMessage`는 삭제했다.
  - `finance-ledger-summary.tsx`, `finance-overview-screen.tsx`: 직접 쓰던 요약 카드를 `StatTile`로 바꿨다.
  - `finance-books-screen`, `finance-ledger-table`, `finance-lesson-income-screen`, `finance-payroll-screen`: `EmptyListMessage`를 `EmptyState`로 교체했다.
- 표 기본 패딩·헤더 색은 1단계에서 `ui/table.tsx`가 이미 흡수했다. 화면의 중복 className 제거는 4단계에서 화면별로 한다.
- `src/app/app-shell.test.tsx`: 2단계에서 남긴 Warning 대로 헤더 사용자 영역 테스트(원장·데스크·선생님)를 추가했다.
- `docs/engineering/design-system.md`: "공용 조합 컴포넌트" 절을 추가했다.

## 연결된 요구사항

- 기능 요구사항 변경 없음. 수입 관리의 금액 의미 색 규칙(`FinanceAmount`와 `text-total/income/expense`), 월 선택, 검색, 접근 가능한 묶음(`role="group"`)은 이전과 같다.

## 먼저 작성한 테스트와 Red 확인

- `src/components/shared/section-card.test.tsx`, `stat-tile.test.tsx`, `empty-state.test.tsx`(10개)를 구현 전에 먼저 작성했다. 구현이 없는 상태에서 3개 파일이 모두 모듈을 찾지 못해 실패하는 것을 확인했다(`no tests`, 3 failed). 구현 후 `StatTile`을 별칭에서 라벨·값 조합 컴포넌트로 바꾸며 테스트도 같이 고쳤다.
- 테스트는 role, 접근 가능한 이름, 보이는 텍스트로만 찾는다. `padded`와 `emphasized`는 시각 스타일이라 "켜고 끌 때 클래스가 달라진다"만 확인한다. 정확한 클래스 문자열은 단언하지 않는다.
- 헤더 사용자 영역 테스트는 이미 구현된 표시 동작을 검증해서 먼저 실패시킬 수 없었다. 대신 기대값을 `원장님`으로 일부러 틀리게 바꿔 실패하는 것을 확인한 뒤 되돌렸다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | 새 테스트의 `as const`가 `PermissionContext`와 맞지 않아 한 번 실패했고, `it.each<[PermissionContext, string]>`로 고쳤다. `next build`가 먼저 알려 줬다(vitest는 타입을 검사하지 않는다) |
| `pnpm test:run` | 162개 파일·1,889개 테스트 통과 | 이전 1,876개 + 공용 부품 10개 + 사용자 영역 3개. 수입 화면의 기존 테스트는 수정 없이 통과 |
| `pnpm test:e2e` | 20개 통과 | 데모 production build 포함 |
| 가로 넘침 | 0px | 1280(전체 수입·입출입내역), 390(입출입내역)에서 측정 |

## 브라우저 증거

- 데모 production build를 `next start -p 3107`로 띄워 Playwright로 촬영했다. 직접 확인한 화면: 1280px 수입 관리 전체 수입, 390px 입출입내역.
- 확인한 것: 요약 타일의 라벨·금액 색(수입 초록, 지출 빨강, 순수익 남보라), 월별 총 수입·출금 타일, 검색 카드, 가운데 정렬된 빈 안내 문구(`이 달에 기록된 입출입내역이 없습니다.`).
- 스크린샷은 세션 임시 폴더에만 두고 저장소에는 넣지 않았다. 1280px 입출입내역 화면은 촬영만 하고 직접 확인하지 않았다.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다.

## Quality Consolidation

- 가독성: 카드·헤더·요약·빈 안내가 이름 있는 부품이 되어, 화면 코드가 `rounded-lg border border-border bg-card p-4` 같은 클래스 나열 대신 "구획", "요약 값"으로 읽힌다.
- 예측 가능성: 부품은 `div`/`h2`/`p` 구조와 접근성 속성을 그대로 전달한다. 헤더 제목 단계는 기본 h2이고 바꿀 때만 `as`를 쓴다. `StatTile`의 `role`·`aria-label`은 호출한 쪽이 정하므로 기존 수입 화면의 접근성 트리가 그대로다.
- 응집도: 카드 모양(테두리·그림자·모서리)은 `SectionCard` 한 곳이, 라벨·값 글자 크기는 `StatFigure` 한 곳이 정한다. 함께 바뀌는 시각 규칙만 묶었고 도메인 판단(배지 상태 매핑)은 묶지 않았다.
- 결합도: 부품은 shadcn `Card`/`Empty`와 `cn`만 안다. 금액 의미 색은 부품이 모르고 `FinanceAmount`를 값으로 받는다. 수입 도메인 코드가 공용 부품을 가져다 쓰는 단방향이다.
- simplify 결과: 처음 만든 `StatTile`이 `SectionCard`의 별칭이라 라벨·값까지 조합하는 부품으로 바꿨다. `LoadingState`는 `EmptyState`와 겹쳐 만들지 않았다. `EmptyListMessage`는 대체되어 삭제했다.
- Warning(남김): `EmptyState`가 안내 문구를 가운데 정렬·넓은 여백으로 보여 이전의 왼쪽 정렬 한 줄보다 세로 공간을 더 쓴다. 4단계에서 표 안 빈 행이 과하게 커 보이면 여백을 줄인다.
- Warning(남김): `SectionCard`는 기본 `p-4`다. 이전 코드의 `p-5`·`p-6` 카드는 4단계에서 `className`으로 덮어쓰거나 `p-4`로 통일할지 화면별로 정한다.

## 남은 위험 또는 미확정 질문

- 수입 외 화면(원생·교재·회차권·레슨 등)의 카드 38곳 중 이번에 바꾼 곳은 수입 화면의 5곳뿐이다. 나머지는 4단계에서 화면별로 전환한다.
- 화면마다 다른 섹션 제목 크기(`text-2xl`/`text-lg`/`text-base`)는 `SectionHeader`로 옮기며 통일한다. 이때 제목 크기가 달라 보이는 화면이 생기므로 4단계 확인 때 함께 본다.
