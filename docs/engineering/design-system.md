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
- 반복되는 운영 앱 패턴은 `src/components/management/` 아래에 shadcn 조합 컴포넌트로 둔다.
- 컴포넌트별 선택 기준은 [shadcn-component-guide.md](./shadcn-component-guide.md)를 따른다.

## 레이아웃

- 기본 shell은 persistent sidebar와 compact main content다.
- main content는 작은 header, toolbar filter, table 또는 calendar body를 중심으로 구성한다.
- 원생/선생님/거래처, 수입 탭처럼 하위 영역이 나뉘는 곳은 tabs를 사용한다.
- 생성/수정 흐름은 dialogs를 기본으로 한다.
- 현재 맥락을 유지하는 편이 좋은 workflow에만 drawer 또는 side panel을 사용한다.

## 기본 컴포넌트 후보

- `Sidebar`
- `Table`
- `Data Table`: shadcn `Table` + TanStack Table 조합으로 만든다.
- `Tabs`
- `Dialog`
- `Form`
- `Calendar`
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

## TanStack 기준

- API 캐싱과 서버 상태는 `@tanstack/react-query`를 사용한다.
- 단순 읽기 목록은 shadcn `Table`만 사용해도 된다.
- 정렬, 컬럼 숨김, 페이지네이션, row selection, column filter, server-side filter가 들어가는 순간 TanStack Table을 사용한다.
- TanStack Table은 headless 엔진으로만 사용하고, 화면에 보이는 마크업과 스타일은 shadcn `Table`, `Checkbox`, `DropdownMenu`, `Button`, `Pagination`으로 구성한다.
- 차트가 필요하면 우선 shadcn `Chart`를 사용하고, 데이터 변환은 도메인 pure function으로 분리한다.

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
