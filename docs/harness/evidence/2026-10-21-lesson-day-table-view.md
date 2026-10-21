# 레슨 보기 재구성: 월별 캘린더뷰와 일별 테이블뷰

## 요약

- 요청(2026-10-21): (1) 탭 이름을 `월별 캘린더뷰`/`일별 테이블뷰`로 바꾸고 탭을 키운다. (2) 월별 메모지 버튼을 달력의 "오늘로 이동" 옆으로 옮기고 `N월 메모지`로 부른다. (3) 일별 테이블뷰에 날짜 선택·이전/다음 날짜·오늘로 이동을 두고, `M월 D일 메모지` 버튼을 둔다. (4) 개인레슨에도 같게 적용한다. 사용자는 "일별 테이블뷰는 출석 확인 모달이 하던 일을 모두 한다"는 뜻을 명시했다.
- 해석이 갈리는 부분은 추측하지 않고 계획 단계에서 질문해 결정했다(계획: `~/.claude/plans/valiant-puzzling-cosmos.md`).
- 이전 작업: [메모지 다이얼로그화와 패널 제거](./2026-10-21-lesson-memo-dialog-and-panel-removal.md).
- 스타일 전용이던 앞선 디자인 정비와 달리 화면 구조와 동작 위치가 바뀌는 작업이다. 저장·권한 로직(`useAcademyLessonActions`, `markPrivateLesson`, 메모 CRUD, `canManage` 분기)은 수정하지 않았다.

## 사용자 결정

| 항목 | 결정 |
| --- | --- |
| 탭 이름 | 접두어 유지: `학원레슨 월별 캘린더뷰` / `학원레슨 일별 테이블뷰`, 개인레슨도 같은 형식 |
| 탭 크기 | 높이 48px, 글자 16px |
| 일별 메모지 | 기존 날짜별 메모(날짜당 여러 개·원생/선생님 지정·수정·삭제)를 메모지 모양 다이얼로그로 |
| 개인레슨 표 | 하루치만 보이는 일별 표(월 전체 목록·페이지네이션·날짜 컬럼 제거) |
| 학원레슨 출석 저장 | 기존 방식 유지(O/X 임시 선택 → `확인`으로 한꺼번에 저장, `취소`로 버림) |
| 결석 사유 폼 | 해당 행 아래에 펼침 |
| 변경 이력 | 표 아래 접이식 섹션 |
| `레슨원생 검색` | 탭 줄 오른쪽 끝 유지 |

## 변경 내용

- 탭·툴바 (`lesson-toolbar.tsx`): 라벨 변경, 탭 크기 확대, 좁은 화면에서 레슨 종류와 보기 이름을 두 줄로 나눔(`ViewTabLabel`). `LessonMonthControl`에 `trailing` 슬롯, 신규 `LessonDayControl`(날짜 선택·이전/다음 날짜·오늘로 이동·`trailing`). `workspace-helpers.ts`에 `shiftDate`.
- 월별 캘린더 (`lesson-month-calendar.tsx`, `lesson-monthly-note.tsx`): `headerActions` 슬롯으로 "오늘로 이동" 바로 뒤에 월별 메모지 버튼을 둔다. 버튼 이름은 `N월 메모지`(다이얼로그 제목 `N월 학원|개인레슨 메모지`는 유지).
- 메모지 공용 껍데기 (`memo-paper-dialog.tsx`): 노란 종이·테이프·줄 배경을 월별·일별 메모지가 함께 쓴다. 일별 메모지(`lesson-day-memo-dialog.tsx`)는 `LessonMemoTabPanel`을 그대로 담고, 노란 종이 위에서 메모 항목이 흰 쪽지로 보이도록 항목 색만 바꾼다.
- 학원레슨 일별 뷰 (`academy-lesson-day-view.tsx`): 날짜 컨트롤 + 일별 메모지 → `AcademyAttendanceChecklist`(검색·필터·집계·전체 등원/결석·행별 이동/삭제/초기화) → `취소`/`확인` → 변경 이력 접이식. 임시 선택 상태는 훅 `useAcademyAttendanceDraft`로 뽑아 출석 확인 모달과 공유한다(모달은 같은 훅으로 리팩터링, 동작 동일). 체크리스트에 `isScrollable` 옵션을 추가해 페이지에 펼칠 때 내부 스크롤을 끈다.
- 개인레슨 일별 뷰 (`private-lesson-day-view.tsx`): 시간·원생·악기·선생님·회차·상태·처리 표 + `이 날짜에 개인레슨 등록` + 일별 메모지 + 변경 이력 접이식. 결석 사유 폼의 열림 상태는 훅 `usePrivateAbsenceReasonForm`, 행 버튼은 `PrivateLessonAttendanceActions`로 뽑아 출석 확인 모달과 공유한다. 선생님(조회 전용)에게는 메모지를 숨기고 배정 회차권 잔여를 행에 보여 준다.
- 변경 이력 섹션 (`lesson-history-section.tsx`): 접혀 있는 동안 내용을 만들지 않아 이력을 불러오지 않는다.
- 워크스페이스: 옛 `AcademyLessonTableView`·`PrivateLessonTableView`와 `privateTableRows`를 제거하고 두 일별 뷰를 연결했다. 날짜 변경 람다 중복을 `selectDate` 하나로 모았다. 선택 날짜의 개인레슨 정렬은 옛 월 표가 지키던 `comparePrivateLessonsByTime`(시간 → 이름 가나다)로 맞춰, 같은 시각 레슨의 이름순이 유지된다(모달도 같은 정렬을 쓴다).
- 문서: `docs/product/functional-spec.md`, `acceptance-scenarios.md`, `traceability-matrix.md`, `docs/harness/decision-log.md`를 새 구조에 맞춰 갱신했다.

## 확인된 영향

- 월별 메모지는 월별 캘린더뷰에서만 열 수 있다. 일별 테이블뷰에서는 월별 메모지(와 미확인 표시)가 보이지 않는다.
- 일별 뷰에서 날짜를 다른 달로 옮기면 선택한 월이 바뀌어 그 달 데이터를 다시 불러온다(`updateSelectedDate`가 이미 처리).
- 개인레슨의 월 전체 목록 보기는 없어졌다. 한 달치를 훑는 용도는 월별 캘린더뷰가 맡는다.

## 먼저 작성한 테스트와 Red 확인

- 구현 전에 먼저 작성해 실패를 확인: `shiftDate`(3개), `lesson-toolbar.test.tsx`(탭 라벨·`trailing` 슬롯·`LessonDayControl`, 6개 중 5개 이상 실패), `lesson-day-memo-dialog.test.tsx`(모듈 없음), `lesson-history-section.test.tsx`·`academy-lesson-day-view.test.tsx`·`private-lesson-day-view.test.tsx`(모듈 없음).
- 처음 쓴 학원 일별 뷰 테스트 중 "날짜가 바뀌면 고르던 내용을 버린다"는 날짜를 바꾸지 않아 아무것도 검증하지 못했고, `rerender`로 날짜를 바꾸는 형태로 다시 썼다.
- 개인 일별 뷰 테스트에는 같은 `renderView`를 두 번 부르는 잘못된 임시 테스트가 있어 정리했다.
- 리팩터링 중 `usePrivateAbsenceReasonForm`을 파생값 방식으로 바꿨더니 기존 모달 테스트 하나("날짜를 바꿨다 돌아와도 폼이 남지 않는다")가 실패했고, 원래의 렌더 중 초기화 방식으로 되돌렸다. 기존 테스트가 동작 변경을 잡아냈다.
- 구조 변경으로 의도대로 실패한 기존 테스트 17개(학원·개인 테이블뷰 탭 테스트 2, 개인 월 표 페이지 이동 5, 메모지 버튼 이름·위치와 날짜 모달 10)는 새 동작 기준으로 고치거나 삭제했다. 개인 월 표 페이지 이동 5개 중 같은 시각 이름순은 일별 기준으로 옮기고 나머지 4개(페이지네이션·월 이동)는 기능이 없어져 삭제했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | |
| `pnpm test:run` | 167개 파일·1,937개 테스트 통과 | 이전 1,896개에서 순증 41개(신규 추가, 개인 월 표 페이지네이션·월 이동 4개 삭제 포함) |
| `pnpm test:e2e` | 22개 통과 | 일별 뷰 날짜 이동·메모지 e2e 1개 추가, 탭 높이 ≥47px·메모지 버튼이 오늘로 이동 오른쪽에 있는지 검사 |

e2e 중 탭 높이 검사가 처음 실패했다. 탭 목록이 `group-data-[orientation=horizontal]/tabs:h-10`으로 40px에 고정돼 키운 탭이 꽉 끼어 있었고, 같은 변형 접두어(`...:h-auto`)로 덮어써 48px로 맞췄다(1280px에서 목록 48px, 탭 40px 확인).

## 브라우저 증거

- 데모 production build(`next start -p 3107`)로 촬영해 직접 확인: 1280px 학원레슨 월별 캘린더(`10월 메모지`가 오늘로 이동 오른쪽), 학원레슨 일별 뷰(날짜 컨트롤·`8월 21일 메모지 1`·출석 체크리스트·취소/확인), 일별 메모지 다이얼로그(노란 종이·메모 폼·메모 항목), 개인레슨 일별 뷰(수업 없는 날의 빈 안내, 수업이 있는 날 결석 사유 폼이 행 아래에 펼쳐진 모습, `이 날짜에 개인레슨 등록`), 390px 학원레슨 탭(두 줄 정렬)과 일별 뷰.
- 촬영 중 발견해 고친 문제: 탭 목록 높이 고정(위), 390px에서 "월별 캘린더/뷰"로 한 글자만 떨어지는 줄바꿈(`ViewTabLabel`로 두 줄 정렬), 일별 메모지 안에서 메모 항목의 하늘색 배경이 노란 종이와 어긋남(항목을 흰 쪽지로).
- 개인레슨 일별 뷰의 `등원 확인` 후 상태 변화와 학원 일별 뷰의 `확인` 저장은 단위·컴포넌트 테스트로 검증했고 화면에서 직접 누르지는 않았다. 변경 이력 섹션은 서비스 연결이 필요해 데모에서 볼 수 없다.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다. 날짜별 메모·월별 메모 API 호출 인자와 출석 저장 경로는 기존 테스트(`lesson-management-workspace.*`)로 그대로 검증된다.

## Quality Consolidation

- 가독성: 워크스페이스에서 테이블뷰별 `onOpenDay` 람다·월 표 데이터 가공이 사라지고 두 일별 뷰에 같은 모양으로 연결된다. 모달과 일별 뷰는 같은 훅·컴포넌트 이름으로 읽힌다.
- 예측 가능성: 학원·개인 모두 `월별 캘린더뷰`/`일별 테이블뷰`, 같은 날짜 컨트롤, 같은 메모지·이력 위치를 쓴다. 모달과 일별 뷰의 버튼 접근성 이름(`{원생} 개인레슨 등원 확인` 등)이 같다.
- 응집도: 출석 임시 선택(`useAcademyAttendanceDraft`)·결석 사유 폼 상태(`usePrivateAbsenceReasonForm`)·행 버튼(`PrivateLessonAttendanceActions`)·메모지 껍데기(`MemoPaperDialog`)가 각각 한 곳에 있어 모달과 일별 뷰가 함께 바뀐다.
- 결합도: 일별 뷰는 저장·삭제·메모 CRUD를 props로 받고 Supabase를 모른다. 변경 이력은 `ReactNode`로 받는다.
- simplify 결과: 쓰이지 않게 된 두 테이블 뷰, `privateTableRows`, 월 표용 페이지네이션 테스트를 제거했고 `selectDate`로 날짜 변경 람다 3벌을 하나로 합쳤다. 처음 쓴 개인 일별 뷰 테스트의 중복 렌더와 학원 일별 뷰의 빈 테스트를 고쳤다.
- Warning(남김): `LessonDayMemoDialog`는 `LessonMemoTabPanel` 안쪽 항목의 색을 `[&_article]` 자손 선택자로 바꾼다. 패널이 항목 마크업(`article`)을 바꾸면 조용히 어긋난다. 패널에 색 옵션을 두는 편이 안전하지만 이번에는 패널을 건드리지 않았다.
- Warning(남김): 모달과 일별 뷰가 같은 기능을 보여 주는 두 경로가 되었다(모달은 월별 캘린더뷰의 날짜 칸에서만 열린다). 한쪽만 고치면 어긋날 수 있어 공유 훅·컴포넌트로 줄였지만, 모달의 학원 표와 일별 뷰의 표는 같은 체크리스트 컴포넌트를 쓴다는 점에 의존한다.
- Warning(남김): 개인레슨 일별 뷰는 모달의 카드 대신 표를 쓴다. 모달은 카드, 일별 뷰는 표로 같은 데이터를 다르게 보여 준다.

## 남은 위험 또는 미확정 질문

- 실제 서비스 연결에서 `변경 이력` 접이식 섹션(로딩·빈 이력·오류)을 직접 확인하지 못했다.
- 일별 뷰에서 다른 달로 날짜를 옮길 때 월 데이터를 다시 불러오는 동안의 깜박임은 데모(로컬 데이터)에서는 보이지 않아 확인하지 못했다.
- 월별 메모지의 미확인 표시는 이제 월별 캘린더뷰에서만 보인다. 일별 뷰만 쓰는 사용자는 미확인 월별 메모를 놓칠 수 있다.
- 커밋과 push는 하지 않았다.

## 커밋 전 `/simplify` 결과 (2026-10-21)

재사용·단순화·효율·추상화 수준 네 관점으로 미커밋 변경 전체(디자인 정비 1~4단계와 이번 레슨 재구성)를 리뷰했다.

적용한 것

- 배정 회차권 잔여 표시를 `AssignedTicketBalanceNote` 하나로 합쳤다(출석 확인 모달과 개인 일별 뷰가 각자 `balances.find`와 문구를 복사하고 있었다).
- 메모지 제목의 레슨 종류 이름을 `MEMO_LESSON_KIND_LABELS` 한 곳으로 모았다(월별·일별 메모지가 각자 상수를 가지고 있었다). 메모지 줄 간격은 `PAPER_LINE_HEIGHT` 하나에서 줄무늬와 글자 줄 간격을 함께 계산한다.
- 쓰이지 않는 `SectionHeader`의 `className` prop과 `useAppShellHeaderActions` 별칭(`usePageHeaderActions`의 다른 이름)을 지웠다.
- 모바일 드로어의 열림 상태를 부모(`AppShell`)에서 `MobileNavigationDrawer` 안으로 옮겨 prop 2개를 없앴다.
- 결석 사유 폼 훅의 날짜 비교 중복(렌더 중 초기화와 파생 비교)을 한 곳으로 줄였다. 다른 날짜로 갔다 돌아와도 폼이 다시 나타나지 않는 동작은 렌더 중 초기화가 유지한다(기존 테스트가 이 동작을 지킨다).
- 변경 이력 요소를 만드는 같은 JSX 두 벌을 `renderHistory(kind)`로 합쳤고, 일별 뷰의 인자를 그대로 넘기는 메모 핸들러 화살표를 직접 전달로 바꿨다.
- 근본 원인 수정: 탭 높이를 호출처가 `group-data-[orientation=horizontal]/tabs:h-auto`로 덮어쓰던 것을 `ui/tabs.tsx`의 `TabsList size="fit"` variant로 올렸다. 요일별 인원확인과 입출입내역 필터의 `Collapsible`은 카드 클래스를 복제하던 대신 `<Collapsible asChild><SectionCard>`로 합성해 카드 모양이 한 곳에서 정해진다.

적용하지 않은 것과 이유

- `canManage && history !== undefined` 권한 검사가 모달·일별 뷰에 중복: 권한이 없는 역할에게 이력이 주어져도 탭을 숨긴다는 동작을 단위 테스트가 지켜서 유지했다(방어선).
- `LessonDayMemoDialog`의 `[&_article]` 자손 선택자: 패널에 색 옵션을 두는 편이 안전하지만 `LessonMemoTabPanel` 변경은 이번 범위 밖이다. Warning으로 남긴다.
- 2MB 폰트 preload(`preload: false`·서브셋): 첫 글자 깜박임·자산 교체가 따르는 성능·UX 결정이라 이번에는 건드리지 않고 남은 위험에 이미 기록했다.
- 월별 메모 쿼리를 일별 뷰에서 끄기: 사유서 자동 기록이 기존 메모 본문을 읽는 흐름에 의존할 수 있어 불확실하다.
- `globals.css`의 `div:has(> [data-responsive-table])` 리셋 목록, `ViewTabLabel`의 줄바꿈 마크업, `app-header`의 시트 닫기 가정(`closest("button")`), 메모 props 6개 통과: 이번 변경 범위를 넘거나(이전 코드에서 옮겨 온 것) 이득이 작아 남겼다.
- `formatWon` 등 기존 중복, 날짜 라벨(`M월 D일`) 포맷터, 빈 표 행 `EmptyState` 통일: 기존 코드이거나 효과가 작아 제외했다.

재검증: `pnpm lint`, `pnpm typecheck` 통과, `pnpm test:run` 167개 파일·1,937개 통과, `pnpm test:e2e` 22개 통과. 합성한 `Collapsible` 카드 두 곳과 탭 높이는 화면에서 직접 확인했다.
