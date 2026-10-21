# UI 디자인 시스템 정비 2단계: 앱 셸(사이드바·헤더·드로어)

## 요약

- 목표: 앱 셸을 플로팅 카드형으로 바꾸고, 613줄이던 `app-shell.tsx`에서 화면 부품을 분리한다. 메뉴 노출·권한·활성 판정 로직은 건드리지 않는 스타일 전용 작업이다.
- 계획: `~/.claude/plans/valiant-puzzling-cosmos.md`의 2단계. 1단계 결과는 [2026-10-21-ui-redesign-stage1-tokens.md](./2026-10-21-ui-redesign-stage1-tokens.md)다.
- 사용자 결정: 플로팅 카드형, 헤더는 제목·하위 탭·액션·사용자 영역, 라이트 전용.

## 변경 내용

- `src/app/app-shell.tsx` (613줄 → 약 290줄): 조합과 로직만 남겼다.
  - 그대로 둔 함수(본문을 이전 커밋과 문자열 비교해 동일함을 확인): `getVisibleNavigation`, `isNavigationItemVisible`, `isForbiddenRoute`, `findRouteItem`, `getActiveRoute`, `findBestMatch`, `isActivePath`, `useIsCompactHeader`, `matchesCompactHeader`.
  - `AccessDeniedNotice`, `DashboardContent`는 이 파일에 두고 카드 스타일만 바꿨다.
- `src/components/layout/` 신규 파일
  - `app-sidebar.tsx`: `AppSidebar`와 메뉴 부품(`SidebarNavigation`, `NavigationEntry`, `CollapsibleNavigationGroup`, `NavigationLink`). 브랜드 영역에 아이콘 타일을 추가했다.
  - `app-header.tsx`: `AppHeader`, `HeaderActions`(767px 이하 시트 전환 동작 그대로), `HeaderSubNavigation`, 표시 전용 `HeaderUser`.
  - `mobile-navigation-drawer.tsx`: 모바일 메뉴 시트.
  - `navigation-link-styles.ts`: 사이드바와 헤더 탭이 쓰던 중복 활성 클래스를 `navigationLinkClassName` 하나로 모았다.
  - `navigation-types.ts`: `VisibleNavigationItem` 타입. 부품이 `app-shell.tsx`를 거꾸로 import하지 않게 분리했다.
- 스타일
  - 하늘색 바탕 위에 사이드바(`rounded-2xl`, 스크롤은 메뉴 영역 안에서만)와 sticky 헤더 카드가 각각 흰 카드로 뜬다. 컨테이너는 `max-w-[90rem]`(이전 `7xl`=80rem)이고 바깥 여백은 모바일 12px, 데스크톱 16px이다.
  - 활성 메뉴는 연한 파랑 알약과 primary 아이콘, 헤더 하위 탭은 알약형이다. 하위 메뉴가 활성이면 상위 메뉴는 글자색만 강조한다. `aria-current`는 이전과 같다.
  - 헤더 오른쪽에 학원 이니셜 아바타와 `학원명 · 역할`을 표시한다(`sm` 이상에서 글자 표시).
  - 대시보드 바로가기와 접근 거부 안내는 `rounded-xl` 카드와 `shadow-card`, 로그인·로딩 화면(`academy-session-gate.tsx`)은 `rounded-2xl` 카드로 맞췄다. 인증 로직은 수정하지 않았다.
- `docs/engineering/design-system.md`: 레이아웃 절에 플로팅 카드형 셸 규칙과 구성 파일을 추가했다.

## 유지한 계약

- aria-label `주요 메뉴`, `모바일 주요 메뉴`, `{제목} 하위 메뉴`, `바로가기`와 메뉴 링크의 텍스트·순서·href.
- `메뉴 열기`, `작업 메뉴 열기` 버튼과 `페이지 작업` 시트(767px 이하), `lg` 기준 사이드바·드로어 전환.
- 헤더(`banner`) 안에 `현재 학원: …` 문구를 두지 않는 규칙(`app-shell.test.tsx`). 사용자 영역은 `더 클래식 · 원장`처럼 다른 문구로 표시한다.
- `data-responsive-table`, `data-label`과 표 브레이크포인트.

## 연결된 요구사항

- 기능 요구사항 변경 없음. 역할별 메뉴 노출(owner·desk·teacher)과 접근 거부 안내는 `app-shell.test.tsx`의 기존 시나리오가 그대로 검증한다.
- 사용자 영역의 역할 표시(`원장`, `데스크`, `선생님`, `게스트`)는 `permissionContext.role`을 읽어 보여 주는 표시 전용 값이다. 권한 판단에는 쓰지 않는다.

## 먼저 작성한 테스트

스타일·구조 분리 전용이라 새 동작이 없다. 기존 `app-shell.test.tsx`(메뉴 순서·권한·접기·드로어·하위 탭·헤더 액션 시트)와 e2e를 안전망으로 썼고, 분리 직후 전부 통과해 Red로 만들 실패 테스트가 없었다. 새 `HeaderUser`의 역할 표시는 아직 전용 테스트가 없다. 3단계 전에 `app-shell.test.tsx`에 역할별 표시 확인 테스트를 추가할지 정한다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | |
| `pnpm test:run` | 159개 파일·1,876개 테스트 통과 | 변경 전과 같은 개수. 최종 스타일 조정 후 다시 실행 |
| `pnpm test:e2e` | 20개 통과 | 데모 production build 포함. 달력 배치(320~1280px), 반응형 표, 헤더 액션 시트 포함 |
| 로직 함수 본문 비교 | 9개 모두 동일 | 이전 커밋의 `app-shell.tsx`와 문자열 비교 |
| 가로 넘침 | 0px | 1280(대시보드·원생), 1023(교재), 390(원생)에서 `scrollWidth - innerWidth` 측정 |

## 브라우저 증거

- 데모 production build를 `next start -p 3107`로 띄워 Playwright로 촬영했다. 직접 확인한 화면: 1280px 대시보드, 1280px 원생 목록, 1023px 교재 재고, 390px 원생 목록, 390px 메뉴 드로어.
- 확인한 것: 플로팅 사이드바와 헤더 카드, 하위 탭 알약, 액션 버튼과 아바타 정렬, 상위 메뉴 글자색 강조, 모바일 헤더(메뉴·제목·작업·아바타) 한 줄 배치, 드로어 안 메뉴 구조.
- 스크린샷은 세션 임시 폴더에만 두고 저장소에는 넣지 않았다. 이 단계에서 처음 촬영 스크립트의 경로와 선택자 오류(없는 `/books/stock` 경로, 부분 일치하는 버튼 이름)가 있었고 스크립트를 고쳐 다시 찍었다. 앱 결함이 아니다.
- 역할별(desk·teacher) 화면은 브라우저로 직접 보지 않았고 `app-shell.test.tsx`로 검증했다.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다.

## Quality Consolidation

- 가독성: 한 파일에 섞여 있던 사이드바·헤더·드로어를 이름 있는 부품 4개로 나눴다. `app-shell.tsx`는 "무엇을 어떤 순서로 배치하는지"와 메뉴 판정만 남아 위에서 아래로 읽힌다.
- 예측 가능성: 사이드바와 헤더 탭이 같은 `navigationLinkClassName`을 써 활성 색이 항상 같다. 부품은 props만으로 그려지고 `app-shell.tsx`를 import하지 않는다.
- 응집도: 활성 스타일 정의를 한 곳으로 모았고(이전에는 두 곳에 템플릿 문자열 복붙), 메뉴 판정은 로직과 함께 `app-shell.tsx`에 남겼다. 헤더 액션의 시트 전환은 `HeaderActions` 안에 같이 있다.
- 결합도: 메뉴 데이터(`domain/navigation`)와 권한 판정은 화면 부품이 모른다. 부품은 이미 걸러진 `VisibleNavigationItem[]`만 받는다. `isCompact`는 훅이 `app-shell.tsx`에 남아 props로 내려간다.
- simplify 결과: 링크 크기 클래스를 `variantClassNames` 한 표로 모아 템플릿 문자열 분기를 없앴고, `HeaderActions`는 본문을 바꾸지 않고 이동만 했다. 상위 메뉴 강조는 판정 로직을 늘리지 않고 `hasActiveChild` 스타일 인자 하나로 처리했다.
- Warning(남김): `HeaderUser`에 전용 단위 테스트가 없다. 표시 전용이라 위험은 낮지만 3단계 전에 추가할지 정한다.
- Warning(남김): 헤더 카드는 `sticky`라 긴 목록을 스크롤할 때 세로 공간을 일부 차지한다(1280px·390px 스크린샷 기준 약 140px). 하위 탭이 있는 화면에서 특히 크다. 불편하면 스크롤 시 탭을 접는 방안을 검토한다.

## 남은 위험 또는 미확정 질문

- 헤더 아래에 카드 없이 떠 있는 화면 제목(예: 교재 "교재 등록 관리")은 3·4단계의 `SectionCard`·`SectionHeader`로 정리한다.
- 컨테이너 최대폭을 80rem에서 90rem으로 넓혔다. 넓은 모니터에서 표가 너무 퍼져 보이면 다시 줄인다.
