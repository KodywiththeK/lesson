# UI 디자인 시스템 정비 4단계-5: 레슨 영역과 전체 마무리

## 요약

- 목표: 레슨 시간표(달력·표·다이얼로그)에 공용 부품을 적용하고, 남은 하드코딩 색 3곳과 이를 단언하던 테스트를 토큰·동작 기준으로 정리한다. 로직은 건드리지 않는 스타일 전용 작업이다.
- 이전: [수입](./2026-10-21-ui-redesign-stage4-finance.md), [교재](./2026-10-21-ui-redesign-stage4-books.md), [인원](./2026-10-21-ui-redesign-stage4-people.md), [회차권](./2026-10-21-ui-redesign-stage4-tickets.md). 이 문서로 계획의 1~4단계가 모두 끝났다.
- 사용자 결정(이 영역): 개인레슨 복사 버튼은 `success` 토큰 버튼, 달력 점은 남보라(`chart-3`) 토큰.

## 변경 내용 (`src/features/lessons/` 등)

- 표 중복 클래스: `TableHeader`의 `bg-muted text-muted-foreground`와 `px-4 py-3`을 66곳에서 지웠다(출석 체크리스트·결석 다이얼로그 2개·학원/개인 표 보기).
  - 출석 체크리스트의 스크롤 고정 헤더는 반투명 기본 배경이면 아래 행이 비쳐 `sticky top-0 bg-muted`로 불투명 배경을 직접 지정했다.
- 카드: 학원레슨 표 보기, 개인레슨 표 보기, 월 달력, 도구 모음(`role="toolbar"`, `aria-label` 유지)을 `SectionCard`로 바꿨다. 요일별 인원확인(`academy-weekday-summary`)과 입출입내역 필터(`finance-ledger-filters`)의 `Collapsible` 루트는 구조를 두고 `rounded-xl ... shadow-card`로 카드 모양만 같게 맞췄다.
- 하드코딩 색 제거
  - `private-schedule-dialog`, `private-student-search-dialog`의 `GREEN_BUTTON_CLASS_NAME`(`bg-green-600`) 2개를 지우고 복사 버튼에 `variant="success"`를 썼다.
  - `lesson-month-calendar`의 일정 점 `bg-purple-500`을 `bg-chart-3` + `data-slot="calendar-event-dot"`로 바꿨다.
  - 달력의 `text-[10px]` 3곳을 `globals.css`에 정의한 `text-2xs` 토큰(`--text-2xs: 0.625rem`)으로 바꿨다.
- `teachers/teacher-list-table.tsx`에 남아 있던 조건부 `px-4 py-3`도 정리했다.
- `docs/engineering/design-system.md`: `text-2xs` 토큰, 공용 부품 전환 완료, 상태 색 variant 사용 규칙을 갱신했다.

## 테스트 변경 (클래스 → 동작 기준)

| 파일 | 이전 단언 | 이후 |
| --- | --- | --- |
| `private-lesson-workspace.test.tsx` | `.bg-purple-500` 존재 | `[data-slot="calendar-event-dot"]` 존재 |
| `private-lesson-workspace.test.tsx` (2곳) | 복사 버튼 `className`에 `bg-green` | `data-variant="success"` |
| `private-lesson-workspace.test.tsx` | 초기화 버튼 `className`에 `bg-secondary` | `data-variant="secondary"` |
| `lesson-management-workspace.test.tsx` | 오늘 칸 `className`에 `border-primary` | 삭제. 바로 위 `aria-current="date"` 단언이 의미를 이미 검증한다 |

- 코드를 바꾼 뒤 원래 단언을 먼저 돌려 3개 테스트가 실패하는 것을 확인했고(Red), 위처럼 고쳐 통과시켰다. `border-primary` 단언은 오늘 칸 클래스를 건드리지 않아 아직 통과하고 있었으나 같은 이유로 정리했다.

## 바꾸지 않은 것

- `lesson-management-workspace.tsx`(1,279줄)는 수정하지 않았다. `canManage` 조건부 렌더, 드래그·메모·출석 로직, 상태와 핸들러가 모두 그대로다.
- `lesson-management-workspace.private-absence.test.tsx`의 `.justify-between`, `.ml-auto` 조상 탐색은 워크스페이스의 해당 래퍼 클래스를 바꾸지 않아 그대로 통과한다. 이 래퍼를 바꾸는 일이 생기면 role 기반으로 바꾼다.
- `student-list-screen.test.tsx`의 원생 툴바 클래스 단언도 같은 이유로 그대로다.
- `lesson-monthly-note.tsx`의 연한 파랑 메모 패널(`bg-accent/40`)과 달력 칸(`bg-background`)은 의도한 안쪽 구획 색이라 유지했다.

## 연결된 요구사항

- 기능 요구사항 변경 없음. `docs/product/`의 학원레슨·개인레슨 시간표, 일정 복사, 결석·출석 명세와 `design-system.md`를 그대로 지켰다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | |
| `pnpm test:run` | 162개 파일·1,891개 테스트 통과 | |
| `pnpm test:e2e` | 20개 통과 | 학원레슨 달력 7개 폭 배치 검사 포함 |
| 가로 넘침 | 0px | 1280(학원레슨·개인레슨), 390(개인레슨), 8월 달력 1280·390 |
| 남은 하드코딩 | 없음 | `bg-(green\|purple\|blue\|red\|yellow\|orange)-N`, `text-[10px]`, hex가 `src`(테스트·shadcn `chart.tsx` 제외)에 남지 않았다. 직접 `rounded-lg border border-border bg-card`도 남지 않았다 |

## 브라우저 증거

- 데모 production build로 촬영해 직접 확인한 화면: 1280px 학원레슨표(달력), 개인레슨표(달력), 선생님별 레슨시간표 다이얼로그, 8월 개인레슨 달력.
- 확인한 것: 도구 모음·달력·요일별 인원확인 카드 모양, 오늘 칸 표시, 일정 칸의 남보라 점과 `text-2xs` 글자, 초록 복사 버튼과 연한 파랑 초기화 버튼, 헤더 액션(개인레슨 등록·결석인원·레슨시간표 보내기) 정렬.
- 8월 달력의 일정 칩은 칸 폭이 좁아 시간과 이름이 잘려 보인다(이전에도 `truncate` 구조). 390px 8월 달력과 표 보기, 1280px 학원레슨 일정은 촬영만 하고 직접 확인하지 않았다.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다.

## Quality Consolidation

- 가독성: 색·크기를 의미 이름(`success`, `chart-3`, `text-2xs`)으로 읽을 수 있고, 두 파일에 복붙돼 있던 `GREEN_BUTTON_CLASS_NAME`이 사라졌다.
- 예측 가능성: 모든 화면의 표·카드·상태 버튼이 같은 토큰을 쓴다. 테스트는 이제 `data-variant`, `aria-current` 같은 동작 기준 속성으로 확인한다.
- 응집도: 상태 색의 정의는 `globals.css`의 `--success`와 `Button`의 variant 한 곳이다. 달력 점의 색은 `chart-3` 토큰만 바꾸면 된다.
- 결합도: 테스트가 스타일 클래스에서 `data-*` 속성으로 옮겨져, 색이나 모양을 바꿔도 테스트가 깨지지 않는다.
- simplify 결과: repo 전체에서 직접 카드 클래스, 중복 표 클래스, 하드코딩 팔레트 색을 다시 검색해 남은 것이 없음을 확인했다(`teacher-list-table`의 조건부 클래스 1곳을 추가로 정리).
- Warning(남김): `Collapsible` 카드 2곳은 `SectionCard`가 아니라 같은 클래스 문자열을 직접 쓴다. 모양을 바꾸면 이 두 곳도 함께 고쳐야 한다.
- Warning(남김): 사용되지 않는 `AcademyLessonAttendanceScreen`과 `section` 모드의 개인레슨 등록 제목(`text-2xl`)은 코드 정리 대상으로 남겼다.

## 전체 작업의 남은 위험 또는 미확정 질문

- Dialog의 sr-only "Close"는 그대로다. 테스트 12곳 이상이 이 이름으로 버튼을 찾고 일부 다이얼로그는 별도 "닫기" 버튼이 있어, 문구 변경은 스타일 작업이 아니라 별도 작업이다.
- Pretendard Variable(2.0MB)이 모든 페이지에서 preload된다. 느린 모바일 회선에서 첫 로드가 길어지면 subset 파일로 바꾼다.
- Badge `default`·`destructive`가 채움에서 연한 배경으로 바뀌어 강조가 약해졌다. 더 강한 표시가 필요한 곳이 생기면 화면별로 정한다.
- `EmptyState`의 가운데 정렬·넓은 여백이 실제 빈 화면에서 과해 보일 수 있다.
- 헤더 카드가 sticky라 하위 탭이 있는 화면에서 세로 공간을 약 140px 쓴다.
- 직접 확인하지 못한 화면이 있다(390px 일부, 역할별 데스크·선생님 화면). 단위·e2e 테스트와 가로 넘침 측정으로만 검증했다.
- 커밋과 push는 하지 않았다. 변경은 작업 트리에 그대로 있다.
