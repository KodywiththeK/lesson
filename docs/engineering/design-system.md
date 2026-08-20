# 디자인 시스템

## 방향

이 제품은 여러 음악학원이 가입해 쓰는 운영 관리자 앱이다. 장식적인 마케팅 화면보다 조용하고, 밀도 있고, 신뢰할 수 있는 작업 도구처럼 느껴져야 한다.

## shadcn 기준

- shadcn/ui 컴포넌트를 기준으로 만든다.
- `components.json`을 shadcn 경로, alias, style, RSC, icon library의 기준으로 유지한다.
- theme token은 semantic CSS variables를 사용한다.
- 버튼과 메뉴 액션의 아이콘은 lucide icons를 우선 사용한다.

## 레이아웃

- 기본 shell은 persistent sidebar와 compact main content다.
- main content는 작은 header, toolbar filter, table 또는 calendar body를 중심으로 구성한다.
- 원생/선생님/거래처, 수입 탭처럼 하위 영역이 나뉘는 곳은 tabs를 사용한다.
- 생성/수정 흐름은 dialogs를 기본으로 한다.
- 현재 맥락을 유지하는 편이 좋은 workflow에만 drawer 또는 side panel을 사용한다.

## 기본 컴포넌트 후보

- `Sidebar`
- `Table`
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
