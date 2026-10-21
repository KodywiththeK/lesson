# UI 디자인 시스템 정비 4단계-1: 수입(finance) 영역 적용

## 요약

- 목표: 3단계 공용 컴포넌트를 수입 관리 화면 전체에 적용하고, 화면마다 반복되던 표 패딩·카드·제목 클래스를 걷어 낸다. 로직은 건드리지 않는 스타일 전용 작업이다.
- 계획: `~/.claude/plans/valiant-puzzling-cosmos.md`의 4단계 중 1번 영역. 이전 단계: [1단계](./2026-10-21-ui-redesign-stage1-tokens.md), [2단계](./2026-10-21-ui-redesign-stage2-app-shell.md), [3단계](./2026-10-21-ui-redesign-stage3-shared-components.md).
- 사용자 결정: 4단계는 영역별로 나눠 확인한다. 이 문서는 첫 영역(수입)이고, 다음은 교재다.

## 변경 내용

- 공용 부품 보강 (`src/components/shared/section-card.tsx`)
  - `SectionHeader`에 `headingId`를 추가했다. 학원 고정 수입·교재 내역 화면이 `aria-labelledby`로 제목을 구획 이름으로 쓰고 있어서 필요했다.
  - 제목 크기를 단계에 맞췄다. h2는 `text-lg`, h3는 `text-base`.
- 수입 화면 (`src/features/finance/`, `src/app/finance/finance-page-content.tsx`)
  - 표 래퍼 `rounded-lg border border-border bg-card`를 `SectionCard padded={false}`로 교체했다(교재 내역, 학원 고정 수입, 선생님 월급, 월별 표, 입출입내역 표).
  - 화면 제목+설명 블록을 `SectionHeader`로 교체했다(교재 내역, 학원 고정 수입, 선생님 월급, 교재 발주·입고·지급 소제목, 분류별 수입, 수납/미납 현황).
  - 요약 카드(`선생님 월급`의 지급 완료 급여)를 `StatTile`로, 연도 선택·월별 그래프·분류별 수입·수납 현황 카드를 `SectionCard`로 바꿨다. `region` 역할과 이름(`분류별 수입`, `수납 현황`, `월별 그래프`)은 `role="region" aria-label`로 그대로 유지했다.
  - 입출입내역 로딩 문구와 수입 데이터 로딩 문구를 `SectionCard` + `EmptyState`로 교체했다.
  - 표 중복 클래스를 지웠다. `TableHeader className="bg-muted text-muted-foreground"`, `TableHead`·`TableCell`의 `px-4 py-3`은 1단계에서 `ui/table.tsx` 기본값이 되었다. `px-4 py-3`을 지운 줄은 65곳이다.
- `src/app/globals.css`: 모바일(767px 이하)에서 표 카드를 투명하게 만드는 기존 규칙에 `box-shadow: none`을 추가했다. 카드에 그림자가 생긴 뒤 투명한 래퍼에 그림자만 남던 문제를 막는다.

## 바꾸지 않은 것

- `finance-ledger-filters.tsx`의 필터 카드는 `Collapsible` 루트에 클래스를 직접 붙이는 구조라 `SectionCard`로 바꾸지 않았다. 억지로 감싸면 `Collapsible` 구조가 달라진다.
- 월별 요약 표·분류별 카드·수납 현황의 안쪽 상자(`rounded-md border border-border p-3`)와 `figcaption`(차트 제목)은 카드 안쪽 구성이라 그대로 두었다.
- 도메인 판단(금액 톤, 수납 상태 매핑, 월 선택 로직)과 `FinanceAmount`, 훅, 쿼리는 수정하지 않았다.

## 연결된 요구사항

- 기능 요구사항 변경 없음. `docs/engineering/design-system.md`의 금액 의미 색 규칙(`text-total/income/expense`), 표의 반응형 기준을 그대로 지켰다.

## 먼저 작성한 테스트와 Red 확인

- `src/components/shared/section-card.test.tsx`에 `headingId`로 `aria-labelledby` 구획 이름을 얻는 테스트와 제목 단계별 크기 테스트를 먼저 추가했고, 구현 전에 두 테스트가 실패하는 것을 확인했다.
- 수입 화면은 기존 테스트(`src/features/finance`, `src/app/finance`의 10개 파일·177개 테스트)를 안전망으로 썼다. 변환 후 수정 없이 통과했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | |
| `pnpm test:run` | 162개 파일·1,891개 테스트 통과 | 이전 1,889개 + `SectionHeader` 테스트 2개 |
| `pnpm test:e2e` | 20개 통과 | 데모 production build 포함 |
| 가로 넘침 | 0px | 1280(학원 고정 수입·전체 수입·선생님 월급·입출입내역), 390(교재 내역·입출입내역·학원 고정 수입) |

## 브라우저 증거

- 데모 production build로 촬영해 직접 확인한 화면: 1280px 학원 고정 수입, 선생님 월급, 전체 수입(전체 페이지), 입출입내역, 390px 교재 내역.
- 확인한 것: 표 카드의 둥근 모서리와 헤더 배경, 화면 제목·설명과 카드 간격, 요약 타일, 분류별·수납 카드, 입출입내역 빈 안내 문구, 모바일 카드형 표.
- 스크린샷에서 발견한 문제: 390px에서 투명해진 표 래퍼에 그림자가 남았다. `box-shadow: none`을 추가하고 390px 학원 고정 수입을 다시 촬영해, 행 카드만 보이고 래퍼 그림자가 없는 것을 직접 확인했다.
- 스크린샷은 세션 임시 폴더에만 두었다.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다.

## Quality Consolidation

- 가독성: 화면 코드에서 `rounded-lg border border-border bg-card`와 `px-4 py-3` 반복이 사라지고, `SectionCard`·`SectionHeader`·`StatTile` 이름으로 읽힌다. 파일마다 표 한 줄이 짧아졌다.
- 예측 가능성: 구획 제목은 화면 제목 h2(`text-lg`), 카드 안쪽 소제목 h3(`text-base`)로 단계가 정해졌다. 구획 이름(`region`)과 `aria-labelledby` 연결은 이전과 같다.
- 응집도: 카드 모양과 표 기본 패딩이 각각 `SectionCard`와 `ui/table.tsx` 한 곳에 있어, 모양을 바꿀 때 수입 화면 파일을 열 필요가 없다.
- 결합도: 화면은 공용 부품의 props(`padded`, `headingId`, `as`)만 안다. 표의 `data-label`/`data-responsive-table` 계약은 그대로다.
- simplify 결과: 삭제한 클래스가 기본값과 같은지 `ui/table.tsx`와 대조했다(`TableHead h-11 px-4`, `TableCell px-4 py-3`). 일부 `TableCell className`에 남은 값(`font-medium`, `whitespace-normal`)은 화면별 의미가 있어 유지했다. `Collapsible` 필터 카드처럼 구조상 맞지 않는 곳은 억지로 바꾸지 않았다.
- Warning(남김): `SectionHeader`의 제목 크기가 h2는 `text-lg`로 통일돼, 이전에 `text-base`였던 "분류별 수입"·"수납/미납 현황" 제목이 한 단계 커졌다.

## 남은 위험 또는 미확정 질문

- 4단계 나머지 영역(교재, 원생·선생님·휴원퇴원·거래처·상담, 회차권·출석·개인레슨, 레슨 워크스페이스)은 아직 이전 카드·표 스타일이다. 화면 간 스타일이 잠시 달라 보인다.
- 하드코딩 색 3곳(`private-schedule-dialog`·`private-student-search-dialog`의 초록 버튼, `lesson-month-calendar`의 보라 점)과 이를 단언하는 테스트는 레슨 영역에서 함께 다룬다.
