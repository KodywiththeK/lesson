# shadcn 컴포넌트 사용 가이드

## 목적

이 문서는 학원관리 서비스 UI를 만들 때 Codex가 어떤 shadcn/ui 컴포넌트를 우선 선택해야 하는지 정한다. 새 UI는 직접 만들기 전에 반드시 `src/components/ui/`와 이 문서를 먼저 확인한다.

## 설치 기준

- 프로젝트 기준: `components.json`의 `new-york`, RSC, TypeScript, CSS variables, lucide icon 설정을 따른다.
- 설치된 컴포넌트는 `src/components/ui/`에 둔다.
- shadcn 원본 컴포넌트는 가능한 그대로 유지한다.
- 서비스 도메인에 맞춘 조합은 `src/components/management/`(목록 제어), `src/components/operations/`(입력·툴바 조합)처럼 별도 폴더에 만든다.
- 공식 문서에는 있으나 현재 `new-york-v4` 레지스트리에서 단일 파일로 내려오지 않는 항목은 조합 패턴으로 문서화한다.
- 2026-08-21 기준 공식 shadcn All Components 목록과 `src/components/ui/`를 대조했다.
- 설치 가능한 단일 컴포넌트는 모두 `src/components/ui/`에 내려받아 둔다.
- 단일 레지스트리 항목이 아닌 `Data Table`, `Date Picker`, `Typography`는 이 문서의 조합 규칙을 표준으로 삼는다.
- 현재 프로젝트에서 `Toast`는 Base UI 전용 레지스트리 항목이라 CLI가 설치를 차단한다. Radix/new-york 기준 toast 표준은 공식 안내에 따라 `Sonner`다.
- `Data Table` 구현 엔진으로 `@tanstack/react-table`을 설치해 둔다.

## 현재 설치된 컴포넌트

| 컴포넌트 | 사용 상황 |
| --- | --- |
| `Accordion` | 설정, 도움말, 상세 조건처럼 접었다 펼치는 보조 정보를 표현한다. |
| `Alert` | 로딩 실패, 권한 부족, 환경변수 누락처럼 화면 안에서 바로 알려야 하는 상태에 사용한다. |
| `AlertDialog` | 삭제, 수업 취소, 마이그레이션 실행처럼 되돌리기 어렵거나 민감한 확인 액션에 사용한다. |
| `AspectRatio` | 프로필 이미지, 교재 이미지, 업로드 미리보기의 비율을 고정한다. |
| `Attachment` | 향후 파일 첨부, 영수증, 교재 이미지, 공지 첨부 UI에 사용한다. |
| `Avatar` | 선생님, 원생, 사용자 프로필의 작은 식별 요소에 사용한다. |
| `Badge` | 수납 상태, 출결 상태, 권한, 회차권 상태 같은 짧은 상태값에 사용한다. |
| `Breadcrumb` | 깊은 설정/상세 화면에서 현재 위치를 보여준다. |
| `Bubble` | 고객지원, AI 도우미, 알림 대화형 피드처럼 말풍선 맥락이 있을 때만 사용한다. |
| `Button` | 모든 명령 액션의 기본이다. 아이콘은 lucide를 우선 사용한다. |
| `ButtonGroup` | 동일 맥락의 분할 액션, 보기 전환, 빠른 필터 묶음에 사용한다. |
| `Calendar` | 수업일, 보강일, 출결일, 급여 기간 선택의 달력 본체다. 직접 쓰지 않고 `src/components/operations/date-time-fields.tsx`의 날짜·일시 필드를 통해 쓴다. |
| `Card` | 개별 반복 항목이나 작은 위젯에만 사용한다. 페이지 섹션 전체를 카드로 감싸지 않는다. |
| `Carousel` | 교재 이미지나 안내 이미지처럼 실제로 넘겨볼 자료가 있을 때만 사용한다. |
| `Chart` | 수입, 급여, 원생 수 추이처럼 수치 데이터를 시각화할 때 사용한다. |
| `Checkbox` | 다중 선택, 권한 체크, table row selection에 사용한다. |
| `Collapsible` | 사이드바 그룹, 고급 필터, 보조 상세를 접고 펼칠 때 사용한다. |
| `Combobox` | 원생/선생님/거래처 검색 선택처럼 옵션 수가 많고 검색이 필요한 단일 선택에 사용한다. |
| `Command` | 빠른 검색, command palette, 복합 선택 팝오버의 검색 엔진으로 사용한다. |
| `ContextMenu` | 표 행 우클릭 액션처럼 고급 사용자 흐름에만 제한적으로 사용한다. |
| `Dialog` | 생성/수정 폼, 상세 확인, 짧은 작업 흐름에 사용한다. |
| `Direction` | 드문 RTL/LTR 방향 제어가 필요할 때만 사용한다. |
| `Drawer` | 모바일 또는 현재 맥락을 유지해야 하는 상세 편집 패널에 사용한다. |
| `DropdownMenu` | 표 행 액션, 사용자 메뉴, 정렬/컬럼 메뉴에 사용한다. |
| `Empty` | 데이터가 없을 때 상태 메시지와 다음 액션을 함께 제시한다. |
| `Field` | 폼 label, 설명, 오류, invalid 상태를 한 덩어리로 다룰 때 사용한다. |
| `Form` | `react-hook-form` 기반 검증 폼에 사용한다. 도메인 검증은 별도 pure function과 schema로 분리한다. |
| `HoverCard` | 선생님/원생 이름 hover 상세처럼 클릭 없이 짧은 미리보기를 제공할 때 사용한다. |
| `Input` | 짧은 텍스트, 검색어, 금액, 전화번호 입력에 사용한다. |
| `InputGroup` | 검색 아이콘, 단위, 복사 버튼, prefix/suffix가 붙는 입력에 사용한다. |
| `InputOTP` | 인증 코드나 초대 코드 입력이 생길 때 사용한다. |
| `Item` | 알림, 최근 활동, 검색 결과처럼 반복 리스트 행에 사용한다. |
| `Kbd` | 문서나 도움말에서 키보드 단축키를 표시할 때 사용한다. |
| `Label` | 입력 컨트롤의 접근 가능한 이름을 제공한다. |
| `Marker` | 메시지/문서에서 특정 부분을 시각적으로 표시할 때 제한적으로 사용한다. |
| `Menubar` | 데스크톱 앱형 상단 메뉴가 필요할 때만 사용한다. 일반 내비게이션에는 쓰지 않는다. |
| `Message` | 고객지원, AI 도우미, 시스템 메시지 타임라인에 사용한다. |
| `MessageScroller` | 메시지 목록의 자동 스크롤/하단 고정이 필요할 때 사용한다. |
| `NativeSelect` | 목록 툴바의 단순 필터처럼 옵션 수가 적고 기본 select 동작이 가장 명확한 곳에 사용한다. |
| `NavigationMenu` | 상단 다단 메뉴가 필요할 때 사용한다. 현재 운영 앱 기본 탐색은 `Sidebar`가 우선이다. |
| `Pagination` | 목록이 많아질 때 페이지 이동 컨트롤로 사용한다. server-side pagination과 함께 쓴다. |
| `Popover` | 필터, 날짜 선택, 간단한 보조 입력처럼 작고 맥락적인 패널에 사용한다. |
| `Progress` | 일괄 처리, 업로드, 온보딩 진행률에 사용한다. |
| `RadioGroup` | 상호 배타적인 짧은 옵션 선택에 사용한다. |
| `Resizable` | 복잡한 관리 화면에서 좌우 패널 크기 조절이 필요할 때 사용한다. |
| `ScrollArea` | 사이드바, 긴 메뉴, 긴 패널 내부 스크롤을 안정적으로 처리한다. |
| `Select` | 기본 select보다 커스텀 팝오버 상호작용이 필요한 단일 선택에 사용한다. 단순 목록 필터는 `NativeSelect`가 우선이다. |
| `Separator` | 메뉴, 패널, form section의 시각적 구분선에 사용한다. |
| `Sheet` | 우측 보조 패널, 필터 패널, 모바일 내비게이션에 사용한다. |
| `Sidebar` | 앱의 기본 좌측 내비게이션 구조에 사용한다. |
| `Skeleton` | 데이터 로딩 중 레이아웃 흔들림을 줄이는 placeholder로 사용한다. |
| `Slider` | 숫자 범위나 비율을 직접 조절하는 입력에 사용한다. |
| `Sonner` | toast 표준이다. 저장 완료, 실패, 비동기 처리 결과에 사용한다. |
| `Spinner` | 버튼 내부 또는 짧은 inline loading 상태에 사용한다. 전체 화면 로딩에는 Skeleton을 우선한다. |
| `Switch` | 켜기/끄기 설정에 사용한다. 저장 정책이 즉시 적용인지 저장 버튼형인지 명확히 한다. |
| `Table` | 단순 목록 표의 기본 표현 컴포넌트다. |
| `Tabs` | 같은 맥락 안의 하위 보기 전환에 사용한다. 페이지 이동 대체로 남용하지 않는다. |
| `Textarea` | 메모, 비고, 공지 본문처럼 여러 줄 입력에 사용한다. |
| `Toggle` | 단일 on/off 도구 버튼에 사용한다. |
| `ToggleGroup` | 보기 모드, 요일 선택, 짧은 다중/단일 토글 묶음에 사용한다. |
| `Tooltip` | 아이콘 버튼처럼 의미가 바로 드러나지 않는 컨트롤에 사용한다. |

## 공식 목록 중 조합/제약 항목

| 항목 | 현재 처리 |
| --- | --- |
| `Toast` | 2026-08-21에 `pnpm dlx shadcn@latest add toast`를 실행했지만 현재 프로젝트에서는 Base UI 전용이라고 차단됐다. 액션 결과 알림은 `Sonner`와 `src/components/ui/sonner.tsx`의 `Toaster`를 사용한다. Base UI 전환을 결정하기 전에는 `Toast`를 수동 이식하지 않는다. |
| `Date Picker` | `pnpm dlx shadcn@latest add date-picker` 결과 단일 레지스트리 항목이 없었다. 공식 예시도 `Calendar` + `Popover` + `Button` 조합이며, 독립 `TimePicker`나 월 선택 컴포넌트도 없다. 이 프로젝트는 아래 "날짜·시간·월 입력" 규칙의 공통 필드를 표준으로 삼는다. |
| `Data Table` | `pnpm dlx shadcn@latest add data-table` 결과 단일 레지스트리 항목이 없었다. 표 상태 엔진은 `@tanstack/react-table`, 화면 컴포넌트는 shadcn `Table`, `Checkbox`, `DropdownMenu`, `Button`, `Pagination`, `Skeleton`, `Empty`를 조합한다. |
| `Typography` | `pnpm dlx shadcn@latest add typography` 결과 단일 레지스트리 항목이 없었다. 텍스트 스타일은 `docs/engineering/design-system.md`의 semantic typography 규칙으로 관리한다. |

## 공식 목록 대조표

| 공식 항목 | 레포 기준 |
| --- | --- |
| `Accordion` | 설치됨 |
| `Alert` | 설치됨 |
| `Alert Dialog` | 설치됨 |
| `Aspect Ratio` | 설치됨 |
| `Attachment` | 설치됨 |
| `Avatar` | 설치됨 |
| `Badge` | 설치됨 |
| `Breadcrumb` | 설치됨 |
| `Bubble` | 설치됨 |
| `Button` | 설치됨 |
| `Button Group` | 설치됨 |
| `Calendar` | 설치됨 |
| `Card` | 설치됨 |
| `Carousel` | 설치됨 |
| `Chart` | 설치됨 |
| `Checkbox` | 설치됨 |
| `Collapsible` | 설치됨 |
| `Combobox` | 설치됨 |
| `Command` | 설치됨 |
| `Context Menu` | 설치됨 |
| `Data Table` | 조합형 표준, `@tanstack/react-table` 설치됨 |
| `Date Picker` | 조합형 표준 |
| `Dialog` | 설치됨 |
| `Direction` | 설치됨 |
| `Drawer` | 설치됨 |
| `Dropdown Menu` | 설치됨 |
| `Empty` | 설치됨 |
| `Field` | 설치됨 |
| `Hover Card` | 설치됨 |
| `Input` | 설치됨 |
| `Input Group` | 설치됨 |
| `Input OTP` | 설치됨 |
| `Item` | 설치됨 |
| `Kbd` | 설치됨 |
| `Label` | 설치됨 |
| `Marker` | 설치됨 |
| `Menubar` | 설치됨 |
| `Message` | 설치됨 |
| `Message Scroller` | 설치됨 |
| `Native Select` | 설치됨 |
| `Navigation Menu` | 설치됨 |
| `Pagination` | 설치됨 |
| `Popover` | 설치됨 |
| `Progress` | 설치됨 |
| `Radio Group` | 설치됨 |
| `Resizable` | 설치됨 |
| `Scroll Area` | 설치됨 |
| `Select` | 설치됨 |
| `Separator` | 설치됨 |
| `Sheet` | 설치됨 |
| `Sidebar` | 설치됨 |
| `Skeleton` | 설치됨 |
| `Slider` | 설치됨 |
| `Sonner` | 설치됨, 이 프로젝트의 toast 표준 |
| `Spinner` | 설치됨 |
| `Switch` | 설치됨 |
| `Table` | 설치됨 |
| `Tabs` | 설치됨 |
| `Textarea` | 설치됨 |
| `Toast` | Base UI 전용으로 현재 프로젝트 설치 불가, `Sonner` 사용 |
| `Toggle` | 설치됨 |
| `Toggle Group` | 설치됨 |
| `Tooltip` | 설치됨 |
| `Typography` | 조합형 표준 |

## 조합 규칙

- 검색 입력: `InputGroup` 또는 `Input` + lucide `Search`를 사용한다.
- 짧은 목록 필터: `NativeSelect`를 사용한다.
- 커스텀 팝오버 선택: `Select`를 사용한다.
- 옵션이 많거나 검색이 필요한 필터: `Combobox` 또는 `Command` + `Popover`를 사용한다.
- 목록 표: 단순 목록은 `Table`, 정렬/페이지/선택이 필요하면 `Table` + TanStack Table을 사용한다.
- Data Table: `@tanstack/react-table`로 상태를 계산하고, DOM은 shadcn `Table`로 렌더링한다.
- Date Picker: `Calendar`는 날짜 선택 본체, `Popover`는 floating panel, `Button`은 trigger, `Field`는 label/error를 담당한다. 화면에서는 이 조합을 직접 만들지 않고 아래 공통 필드를 쓴다.
- 빈 목록: `Empty`를 사용하고, 다음 액션이 명확하면 `Button`을 함께 둔다.
- 오류 상태: `Alert`를 사용한다.
- 파괴적 확인: `AlertDialog`를 사용한다.
- 생성/수정 폼: `Dialog` + `Form` + `Field`를 우선한다.
- 긴 상세 편집: `Sheet` 또는 `Drawer`를 사용한다.
- 액션 결과 알림: `Sonner`를 사용한다. `Toast` 이름의 직접 구현체를 만들지 않는다.

## 날짜·시간·월 입력

브라우저 기본 `input type="date|time|datetime-local|month"`는 쓰지 않는다. 화면마다 모양과 동작이 달라지고 모바일·데스크톱에서 일관된 선택 경험을 줄 수 없기 때문이다.

- 위치: `src/components/operations/date-time-fields.tsx`의 `DateField`, `TimeField`, `DateTimeField`, `MonthField`. 설치된 shadcn `Input`, `Button`, `Popover`, `Calendar`, `NativeSelect`만 조합하며 새 기본 부품을 직접 그리지 않는다.
- 값 형식(저장·API 계약은 기존과 같다): 날짜 `YYYY-MM-DD`, 월 `YYYY-MM`, 시간 `HH:mm`(24시간), 일시 `YYYY-MM-DDTHH:mm`.
- 사용법: `<DateField aria-label="등록일" value={v} onValueChange={setV} />`. `aria-label`은 필수이며 기존 `Label` 래핑 구조와 테스트의 `getByLabelText`가 그대로 동작하도록 이전 label 문구를 유지한다. 값 변경은 `event.target.value`가 아니라 문자열 값을 받는 `onValueChange`다.
- 입력 방식: 텍스트 입력으로 직접 쓰거나 옆의 선택기 버튼(`… 달력 열기`, `… 시간 선택 열기`, `… 월 선택 열기`)으로 고른다. 존재하지 않는 값(`2026-02-30`, `24:00`, `2026-13`)과 입력 중인 미완성 값은 `aria-invalid`와 브라우저 제약 검증(`setCustomValidity`)으로 제출을 막는다. 빈 값은 `required`일 때만 막는다.
- `onValueChange` 계약: 완성된 유효 값 또는 빈 문자열만 전달한다. 입력 중인 `2026-1` 같은 미완성 문자열은 필드 안에만 머물고 화면 state, 조회 query, 날짜 계산으로 올라가지 않는다(레슨 캘린더 월 이동이 `Invalid Date`를 만나지 않게 하기 위함). 달력에서는 이미 선택된 날짜를 다시 눌러도 선택이 해제되지 않고 그 값으로 확정된다.
- 시간은 시(00–23)와 분(00–59)을 각각 1분 단위로 고른다.
- 빈 값 정책: 비어 있는 시간·일시에서 선택기를 열어도 오늘 날짜나 `00:00`을 임의로 채우지 않는다. 날짜와 시, 분을 모두 고른 뒤에만 `onValueChange`가 호출되고, 고르다 닫으면 버려진다. 이미 완성된 값에서 일부만 바꾸면 나머지는 유지한다.
- `disabled`이면 입력과 선택기 버튼을 모두 막는다.
- 필드는 형식만 책임진다. 시작<종료, 유효기간 같은 의미 검증은 각 화면의 도메인 helper에서 한다.
- 선택기 버튼은 입력 오른쪽에 있으므로 Popover는 버튼의 오른쪽 끝을 기준으로(`align="end"`) 열린다. 화면 가장자리에서는 Radix 충돌 처리로 안쪽으로 밀린다.
- 선택기는 `PopoverContent`로 열리며 Dialog(`z-[60]`) 위에 보이도록 `z-[70]`을 쓴다. 새 Dialog/오버레이 z-index를 바꾸면 선택기 레이어를 함께 확인한다.
- 모바일: 선택기 폭은 `max-w-[calc(100vw-2rem)]`로 제한한다. 320px 화면에서도 달력과 시·분 선택이 화면 안에 들어와야 한다.
- 월 드롭다운은 브라우저 언어와 상관없이 한국어(`10월`)로 표시한다.

## 금액 입력

- 원 단위 금액은 `Input type="number" min={1} step={1}`로 1원 단위 양의 정수만 허용한다. HTML `step`은 허용 간격이 아니라 `min`에서 출발하는 유효값 격자이므로 `min={1}`에 `step={1000}`을 쓰면 `140000`이 거부된다.
- 쉼표를 문자로 입력하는 UX(`140,000`)는 아직 정해지지 않았다. 필요해지면 표시 포맷과 저장 숫자를 분리한 공통 금액 입력을 설계하기 전에 사용자에게 질문한다.
- 금액 폼 테스트는 `src/test/expect-whole-won-input.ts`의 `expectWholeWonInput`으로 `140000` 허용과 `0`·음수·소수 거부를 확인한다.

## 금지 규칙

- shadcn에 있는 컴포넌트를 손으로 다시 만들지 않는다.
- 기본 HTML `button`, `input`, `select`, `table`을 직접 스타일링해 쓰지 않는다. 예외가 필요하면 이유를 evidence에 기록한다.
- `input type="date|time|datetime-local|month"`를 직접 쓰지 않는다. 위 공통 날짜·시간·월 필드를 사용한다.
- `Card` 안에 또 다른 `Card`를 넣지 않는다.
- 페이지 섹션 전체를 카드처럼 띄우지 않는다.
- 아이콘만 있는 버튼에는 접근 가능한 이름과 필요 시 `Tooltip`을 제공한다.
- 복잡한 table state를 React state만으로 직접 구현하지 않는다. TanStack Table을 사용한다.
