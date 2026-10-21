# 디자인 시스템

## 방향

이 제품은 여러 음악학원이 가입해 쓰는 운영 관리자 앱이다. 장식적인 마케팅 화면보다 조용하고, 밀도 있고, 신뢰할 수 있는 작업 도구처럼 느껴져야 한다.

## shadcn 기준

- shadcn/ui 컴포넌트를 기준으로 만든다.
- `components.json`을 shadcn 경로, alias, style, RSC, icon library의 기준으로 유지한다.
- theme token은 semantic CSS variables를 사용한다.
- 버튼과 메뉴 액션의 아이콘은 lucide icons를 우선 사용한다.
- 새 UI를 만들 때는 먼저 `src/components/ui/`의 shadcn 컴포넌트를 확인한다.
- 직접 만든 input, select, table, dialog, badge, alert, toast, empty state는 금지한다. 필요한 경우 shadcn 컴포넌트를 얇게 조합한 도메인 컴포넌트를 만든다.
- 반복되는 운영 앱 패턴은 `src/components/management/`(목록 제어)와 `src/components/operations/`(입력·툴바) 아래에 shadcn 조합 컴포넌트로 둔다.
- 컴포넌트별 선택 기준은 [shadcn-component-guide.md](./shadcn-component-guide.md)를 따른다.
- 2026-08-21 기준 공식 shadcn All Components 목록을 대조했고, 설치 가능한 단일 컴포넌트는 모두 `src/components/ui/`에 둔다.
- `Toast`는 현재 프로젝트에서 Base UI 전용이라 설치할 수 없으므로 `Sonner`를 공식 toast 표준으로 사용한다.
- `Data Table`, `Date Picker`, `Typography`는 단일 파일 컴포넌트가 아니라 shadcn 조합 패턴으로 관리한다.

## 레이아웃

- 기본 shell은 데스크톱에서 sidebar, `lg` 미만에서 메뉴 버튼으로 여는 drawer와 compact main content다.
- shell은 플로팅 카드형이다. 하늘색 바탕(`background`) 위에 sidebar(`rounded-2xl`)와 sticky 헤더 카드가 각각 흰 카드로 떠 있고, 본문은 바탕 위에 화면별 카드를 올린다. 본문 전체를 감싸는 큰 카드는 만들지 않아 카드가 중첩되지 않는다.
- 헤더 카드는 페이지 제목(`h1`), 하위 탭(알약형), 페이지 액션, 사용자 영역(`학원명 · 역할`)으로 구성한다. 사용자 영역은 표시 전용이며 `현재 학원: …` 문구는 sidebar와 drawer에만 둔다.
- sidebar와 헤더 하위 탭의 활성 색은 `src/components/layout/navigation-link-styles.ts` 한 곳에서 정한다. 하위 메뉴가 활성이면 상위 메뉴는 글자색만 강조한다.
- shell 구성 파일: `src/app/app-shell.tsx`(조합, 메뉴 가시성·활성 판정), `src/components/layout/app-sidebar.tsx`, `app-header.tsx`, `mobile-navigation-drawer.tsx`.
- main content는 작은 header, toolbar filter, table 또는 calendar body를 중심으로 구성한다.
- 수입 세부 내역이나 휴원/퇴원 상태처럼 같은 화면 안에서 하위 영역이 나뉘는 곳은 tabs를 사용한다.
- 서로 독립된 목록 화면을 하나의 상위 업무로 묶을 때는 중첩 URL과 하위 navigation을 사용한다.
- 같은 데이터 맥락 안에서 빠르게 상태만 전환하는 화면은 tabs를 사용한다.
- 생성/수정 흐름은 dialogs를 기본으로 한다.
- 현재 맥락을 유지하는 편이 좋은 workflow에만 drawer 또는 side panel을 사용한다.

## 공용 조합 컴포넌트

shadcn 부품을 얇게 조합한 화면 공용 부품은 `src/components/shared/`에 둔다. 새 화면에서 아래 패턴이 필요하면 직접 클래스를 쓰지 않고 이 부품을 쓴다.

| 부품 | 용도 | 비고 |
|---|---|---|
| `SectionCard` | 화면 한 구획을 담는 흰 카드 | shadcn `Card` 기반. 기본은 안쪽 여백 `p-4`, 표처럼 가장자리까지 닿아야 하면 `padded={false}` |
| `SectionHeader` | 구획 제목(`h2`) + 설명 + 작업 버튼 | 카드 안쪽 소제목은 `as="h3"` |
| `StatFigure`, `StatTile` | 작은 라벨 아래 큰 숫자 | 금액 색은 `FinanceAmount`를 값으로 넘겨 의미 색을 입힌다 |
| `EmptyState` | 빈 목록·불러오는 중 같은 목록 안 안내 문구 | shadcn `Empty` 기반. `role` 등 접근성 속성은 그대로 전달 |

- 표의 헤더·셀 기본 모양은 `src/components/ui/table.tsx`가 정한다. 화면에서 `px-4 py-3`, `bg-muted text-muted-foreground`를 다시 쓰지 않는다.
- 배지 상태 매핑(출석·수납·회차권)은 도메인 판단이 섞여 있어 공용으로 합치지 않고, 화면에서 `Badge`의 `variant` 이름만 고른다.
- 화면의 카드·표·빈 안내는 이 부품으로 모두 전환했다(2026-10-21). `Collapsible`처럼 루트에 클래스를 직접 붙여야 하는 카드는 `rounded-xl border border-border bg-card shadow-card`를 같은 모양으로 쓴다.
- 상태 색 버튼·배지(`Button variant="success"`, `Badge variant="success|warning|info|destructive"`)가 필요하면 `bg-green-600` 같은 팔레트 색을 쓰지 않고 이 variant를 쓴다. 테스트는 클래스가 아니라 `data-variant`로 확인한다.

## 기본 컴포넌트 후보

- `Sidebar`
- `Table`
- `Data Table`: shadcn `Table` + `@tanstack/react-table` 조합으로 만든다.
- `Tabs`
- `Dialog`
- `Form`
- `Calendar`
- `Date Picker`: `Calendar` + `Popover` + `Button` 조합이며, 화면에서는 `src/components/operations/date-time-fields.tsx`의 필드를 쓴다.
- `Badge`
- `Button`
- `DropdownMenu`
- `Popover`
- `Command`
- `Input`
- `Select`
- `Textarea`
- `Checkbox`
- `AlertDialog`
- `Sonner`
- `Empty`
- `Field`
- `InputGroup`
- `ButtonGroup`
- `Sonner`
- `Tooltip`

## TanStack 기준

- API 캐싱과 서버 상태는 `@tanstack/react-query`를 사용한다.
- 단순 읽기 목록은 shadcn `Table`만 사용해도 된다.
- 정렬, 컬럼 숨김, 페이지네이션, row selection, column filter, server-side filter가 들어가는 순간 TanStack Table을 사용한다.
- TanStack Table은 headless 엔진으로만 사용하고, 화면에 보이는 마크업과 스타일은 shadcn `Table`, `Checkbox`, `DropdownMenu`, `Button`, `Pagination`으로 구성한다.
- 차트가 필요하면 우선 shadcn `Chart`를 사용하고, 데이터 변환은 도메인 pure function으로 분리한다.

## 알림 기준

- 저장 완료, 삭제 완료, 비동기 처리 성공/실패는 `Sonner`의 `toast` API를 사용한다.
- `src/app/layout.tsx`에는 `Toaster`가 있고, `src/app/providers.tsx`에는 전역 `TooltipProvider`가 있다.
- 별도 `toast.tsx` 파일을 손으로 만들지 않는다. Base UI 전환이 결정되면 별도 phase에서 공식 `Toast` 도입 여부를 다시 판단한다.

## 입력 컨트롤 일관성

- 날짜·월·시간·일시는 기본 브라우저 입력 대신 공통 필드(`DateField`, `MonthField`, `TimeField`, `DateTimeField`)를 쓴다. 규칙은 [shadcn-component-guide.md](./shadcn-component-guide.md)의 "날짜·시간·월 입력"이 SSOT다.
- 선택기: 텍스트 입력 오른쪽에 아이콘 버튼을 두고, Popover는 버튼 오른쪽 끝 기준(`align="end"`)으로 연다. 버튼은 `… 달력 열기`처럼 대상이 드러나는 접근 가능한 이름을 가진다.
- 포맷: 값은 사람이 읽고 쓸 수 있는 `YYYY-MM-DD`, `YYYY-MM`, `HH:mm`, `YYYY-MM-DDTHH:mm`이며 `placeholder`로 형식을 보여 준다. 숫자는 `tabular-nums`로 맞춘다.
- 오류: 잘못된 값은 `aria-invalid`와 destructive 토큰의 invalid 스타일로 표시하고 제출을 막는다. 의미 검증 오류는 각 화면의 기존 오류 표현을 쓴다.
- disabled: 입력과 선택기 버튼을 함께 비활성화한다.
- 반응형: 선택기 Popover는 화면 폭 안에 들어와야 하며 320px에서도 가로 스크롤을 만들지 않는다.
- 레이어: Popover(`z-50`)는 Dialog 내용(`z-[60]`)과 Sheet(`z-50`) 위에서도 쓰이므로 선택기는 `z-[70]`을 쓰고, AlertDialog(`z-[70]`/`z-[80]`)는 선택기를 열지 않는다.
- 금액: 입력 중에는 빈 값과 `140,000` 같은 천 단위 표기를 허용하고 저장 때 원 단위 정수와 도메인별 범위를 검증한다. 숫자 기본 입력의 `min`·`step` 격자에 정책을 맡기지 않는다.
- 시간: 시·분 선택과 직접 입력을 함께 제공한다. 시만 입력하고 필드를 떠나면 `:00`으로 채우며 잘못된 값은 유지하고 필드 오류를 보여 준다.

## 월간 캘린더

- 달력이 520px 이상 확보되는 넓은 화면(`xl`, 1280px 이상)에서만 월 전체의 수업과 선택 날짜 수업·월 메모·변경 이력을 나란히 둔다. 그보다 좁으면 오른쪽 내용을 달력 아래로 옮긴다. 화면이 아니라 실제 콘텐츠 폭을 기준으로 잘림을 확인한다.
- 작은 모바일의 7열 날짜 칸에는 긴 수업 문장을 억지로 넣지 않고 예정·등원·결석 건수를 보여 준다. 선택 날짜 목록에서 전체 내용을 읽을 수 있어야 한다.
- 오늘 날짜, 선택 날짜, 수업 상태는 색만으로 구분하지 않고 날짜·상태 문구와 접근 가능한 이름을 함께 쓴다. 결석·패스·취소 기록은 기본 달력 칸에서 숨기고 전체 기록을 켜면 상태명을 함께 보여 준다. 시간이 정해지지 않은 수업에는 임시 시각을 노출하지 않고 `시간 미정`을 표시한다.

## 목록 공통 UI

- 관리 표는 표 아래에 `ListPagination`(총 건수, 번호 이동, 페이지당 10·20·30)을 항상 둔다. 데이터가 적어도 숨기지 않아 규칙이 화면마다 달라 보이지 않게 한다.
- 이름 검색은 `ListSearchField`, 필터는 `ListFilterSelect`를 쓰고, 검색·필터가 바뀌면 1페이지로 돌아간다.
- 빈 결과는 "조건에 맞는 ○○이 없습니다." 한 줄, 로딩 중에는 목록과 페이지 컨트롤이 번쩍이며 사라지지 않도록 이전 데이터를 유지한다(`placeholderData: keepPreviousData`).
- 같은 일을 하는 버튼은 한 번만 둔다(예: 별도 "새로고침"은 자동 재조회가 있으면 두지 않는다). 일괄 처리 버튼 라벨에는 대상 건수를 드러낸다(`현재 목록 3건 출석`).
- 비활성 버튼은 이유를 가까이에 문장으로 안내하고 `aria-describedby`로 연결한다.

## 표의 반응형 표현

- 표는 `1024px` 이상에서만 열·헤더가 있는 shadcn `Table`로 표시한다. 열이 많으면 표 영역 안에서만 가로 스크롤한다.
- `768~1023px`에서는 행 구분을 유지하는 세미테이블로 표시한다. 한 행의 항목을 3열 안팎의 반응형 그리드에 배치하고 항목명을 값 위에 보여 준다.
- `481~767px`에서는 한 줄에 2개를 기본으로, 내용이 짧고 읽을 수 있는 목록만 3개까지 카드로 표시한다. `0~480px`에서는 1개를 기본으로, 아주 짧은 항목만 2개까지 허용한다. 열 수 때문에 긴 이름·금액·버튼이 잘리면 열 수를 줄인다.
- 같은 행 데이터와 액션을 모든 화면 폭에서 유지한다. `TableCell`의 `label`은 좁은 화면의 항목명이며 데스크톱 `TableHead`와 같은 의미여야 한다. 모바일용 별도 목록을 복제해 상태나 mutation 경로를 둘로 만들지 않는다.
- 모달 안의 표도 동일한 기준을 따른다. 카드 안에 카드를 중첩하지 않고, 빈 결과·로딩·페이지네이션·수정/삭제 버튼 접근성을 각 폭에서 확인한다.
- 검증은 `320px`, `480px`, `481px`, `767px`, `768px`, `1023px`, `1024px`와 넓은 데스크톱에서 가로 넘침·글자 겹침·행 높이·액션 접근성을 확인한다.

## 토큰

모든 값은 `src/app/globals.css`의 CSS 변수(oklch)가 SSOT이고, 컴포넌트는 `bg-primary`처럼 의미 이름으로만 쓴다. 화면에 `bg-blue-600` 같은 팔레트 색이나 hex를 직접 쓰지 않는다.

### 색

| 구분 | 토큰 | 용도 |
|---|---|---|
| 표면 | `background` | 앱 바탕(연한 하늘색). 흰 카드 뒤에 깔고, 카드 안쪽 구획에도 쓴다 |
| 표면 | `card`, `popover` | 흰색. 카드·다이얼로그·시트·입력창 배경 |
| 글자 | `foreground`, `muted-foreground` | 본문, 보조 설명(흰 카드 위 대비 6:1) |
| 강조 | `primary` | 주요 버튼, 활성 탭·메뉴 글자, 링크 |
| 강조 | `accent` | 호버, 활성 메뉴 배경, 기본 배지의 연한 파랑 |
| 중립 | `secondary`, `muted`, `border`, `input`, `ring` | 보조 버튼, 구획, 테두리, 포커스 링 |
| 상태 | `success`, `warning`, `info`, `destructive` | 각각 `-foreground`(채움 위 글자), `-soft`(연한 배경), `-soft-foreground`(연한 배경 위 글자) |
| 금액 | `total`, `income`, `expense` | 아래 "금액 의미 색" 참고 |
| 차트 | `chart-1`~`chart-5` | 금액 의미가 없는 일반 차트 계열 |

- 상태 색은 채움(`Button variant="success"`, `destructive`)과 연한 배지(`Badge variant="success|warning|info|destructive"`)로만 쓴다. 모든 조합은 4.5:1 이상 대비를 확인했다.
- 색만으로 뜻을 전하지 않는다. 배지에는 항상 상태 글자를 함께 둔다.
- 다크모드는 켜지 않는다(라이트 전용). `.dark` 변수는 같은 구조로만 유지한다.
- 사이드바 토큰(`sidebar-*`)은 `card`, `primary`, `accent`, `border`를 참조한다.

### 모서리·그림자

| 토큰 | 값 | 용도 |
|---|---|---|
| `rounded-sm` | 8px | 작은 칩, 인라인 요소 |
| `rounded-md` | 10px | 버튼, 입력, 선택 상자 |
| `rounded-lg` | 12px | 카드 안쪽 구획, 메뉴·팝오버, 탭 항목 |
| `rounded-xl` | 16px | 카드, 탭 목록, 알림 |
| `rounded-2xl` | 20px | 앱 셸 패널, 다이얼로그 |
| `shadow-xs`~`shadow-lg`, `shadow-card` | 파란 기운의 얕고 넓은 번짐 | 입력(xs), 카드(card), 팝오버(md), 다이얼로그(lg) |

### 글꼴

- 본문 글꼴은 Pretendard Variable이며 `src/app/fonts/PretendardVariable.woff2`를 `next/font/local`로 직접 포함한다(외부 CDN 없음, SIL OFL 1.1). `--font-pretendard`를 `--font-sans`가 참조한다.
- 본문 자간은 `-0.01em`이다.

### 크기

- 기본 컨트롤 높이는 `h-10`(Button·Input·Select·NativeSelect default), 작은 컨트롤은 `h-9`(`sm`), `h-7`(`xs`)이다.
- 달력 칸처럼 `text-xs`(12px)보다 작아야 하는 곳은 임의값 `text-[10px]` 대신 `text-2xs`(10px) 토큰을 쓴다.

## 상호작용 규칙

- 아이콘 버튼은 접근 가능한 이름을 가져야 한다.
- 의미가 바로 드러나지 않는 아이콘 버튼에는 tooltip을 제공한다.
- 버튼과 표 셀 안의 텍스트는 모바일/데스크톱에서 잘려 보이지 않아야 한다.
- 숨은 affordance보다 role/label이 보이는 control을 우선한다.
- table은 안정적인 row height, pagination, search, clear empty state를 가져야 한다.
- calendar 상호작용은 가능한 범위에서 keyboard와 pointer 모두 접근 가능해야 한다.

## 시각 검증

주요 UI 흐름은 데스크톱과 모바일 폭에서 확인한다.

- 요소 겹침 없음
- 안정적인 버튼 크기
- 읽기 쉬운 한국어 텍스트
- 보이는 focus state
- nested card 없음
- 장식용 gradient orb/bokeh 없음

## 금액 의미 색 (수입 관리)

- 금액의 의미 색은 `src/app/globals.css`의 `--total`(합계, 남보라)·`--income`(수입, 초록)·`--expense`(지출, 빨강) 토큰과 Tailwind `text-total`/`text-income`/`text-expense`로만 쓰고, `src/features/finance/finance-shared.tsx`의 `FinanceAmount`로 한 곳에서 입힌다. 화면에 `text-blue-600` 같은 색을 직접 쓰지 않는다.
- 색만으로 뜻을 전하지 않는다. 금액 앞뒤 라벨("월별 총 수입 (입금)", "월별 총 출금")이나 스크린리더용 텍스트를 함께 둔다.
- 활성 탭 글자색은 `primary`이며(레슨 시간표와 같은 선례), 명세의 보라/청회색 탭 색은 적용하지 않았다. `total`은 `primary` 파랑과 구분되도록 남보라 계열로 둔다.
- 차트는 shadcn `ChartContainer`(recharts)를 쓰고, jsdom에서 그려지지 않으므로 같은 값을 담은 접근성 대체 표를 항상 함께 렌더한다. 그래프 시각 확인(라벨 겹침, 좁은 화면 스크롤)은 브라우저 확인이 필요하다.
