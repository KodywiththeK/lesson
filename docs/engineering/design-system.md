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

- 기본 shell은 persistent sidebar와 compact main content다.
- main content는 작은 header, toolbar filter, table 또는 calendar body를 중심으로 구성한다.
- 수입 세부 내역이나 휴원/퇴원 상태처럼 같은 화면 안에서 하위 영역이 나뉘는 곳은 tabs를 사용한다.
- 서로 독립된 목록 화면을 하나의 상위 업무로 묶을 때는 중첩 URL과 하위 navigation을 사용한다.
- 같은 데이터 맥락 안에서 빠르게 상태만 전환하는 화면은 tabs를 사용한다.
- 생성/수정 흐름은 dialogs를 기본으로 한다.
- 현재 맥락을 유지하는 편이 좋은 workflow에만 drawer 또는 side panel을 사용한다.

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
- 금액: 원 단위는 `min={1} step={1}` 정수 입력이다.

## 목록 공통 UI

- 관리 표는 표 아래에 `ListPagination`(총 건수, 번호 이동, 페이지당 10·20·30)을 항상 둔다. 데이터가 적어도 숨기지 않아 규칙이 화면마다 달라 보이지 않게 한다.
- 이름 검색은 `ListSearchField`, 필터는 `ListFilterSelect`를 쓰고, 검색·필터가 바뀌면 1페이지로 돌아간다.
- 빈 결과는 "조건에 맞는 ○○이 없습니다." 한 줄, 로딩 중에는 목록과 페이지 컨트롤이 번쩍이며 사라지지 않도록 이전 데이터를 유지한다(`placeholderData: keepPreviousData`).
- 같은 일을 하는 버튼은 한 번만 둔다(예: 별도 "새로고침"은 자동 재조회가 있으면 두지 않는다). 일괄 처리 버튼 라벨에는 대상 건수를 드러낸다(`현재 목록 3건 출석`).
- 비활성 버튼은 이유를 가까이에 문장으로 안내하고 `aria-describedby`로 연결한다.

## 토큰

- 기본 semantic token: `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `ring`
- 도메인 상태 토큰은 실제 컴포넌트 필요가 생긴 뒤 추가한다.
- 후보 상태: 출석, 결석, 보강, 패스, 미납, 수납완료, 만료임박
- 한 가지 색상 계열만 지배하는 palette를 피한다.
- neutral surface를 기본으로 하고 상태 색상은 제한적으로 사용한다.

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
