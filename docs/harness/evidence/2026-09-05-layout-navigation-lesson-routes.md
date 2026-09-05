# 공통 레이아웃, 하위 메뉴, 레슨 route 분리 증거

## 요약

- 목표: 전역 헤더 action을 제거하고 페이지별 action slot, 접이식 하위 메뉴, 반응형 drawer, 레슨 하위 route를 도입한다.
- 완료한 변경:
  - `레슨 시간표`를 `학원레슨표` `/lessons/academy`, `개인레슨표` `/lessons/private` 하위 메뉴로 분리했다.
  - `/lessons`는 `/lessons/academy`로 redirect한다.
  - `인원·거래처`, `레슨 시간표` 자식 페이지는 상위 메뉴명을 H1로 표시하고 하위 탭으로 자식 페이지를 구분한다.
  - 전역 `수납 등록`, `출석 확인` action을 제거하고 각 feature screen이 자신의 primary action을 AppShell header에 등록한다.
  - lg 미만에서는 왼쪽 navigation을 `메뉴` drawer로 열고, md 이하에서는 페이지 action을 `작업` drawer에 모은다.
  - 현재 학원 표시는 header에서 제거하고 desktop sidebar와 mobile drawer 안에 둔다.
  - 레슨 캘린더 기본 진입 월은 오늘이 속한 월이며, 오늘 날짜 셀은 `aria-current="date"`와 `오늘` 배지로 구분한다.
  - 메모 탭은 `메모 대상 유형` 선택을 제거하고 `관련 원생`, `관련 선생님` 선택 조합으로 메모 대상을 결정한다.
- 커버한 요구사항: 공통 레이아웃 action 정리, 중복 heading 제거, 하위 메뉴 접기/펼치기, nested route, responsive drawer, sticky header/sidebar, 현재 학원 표시 위치 변경, 현재 월 캘린더, 오늘 하이라이트, 메모 대상 선택 UX 개선.

## 먼저 작성한 테스트

- 테스트 파일:
  - `src/domain/navigation.test.ts`
  - `src/app/app-shell.test.tsx`
  - `src/app/page.test.tsx`
  - `src/app/lessons/page.test.tsx`
  - `src/features/lessons/lesson-management-workspace.test.tsx`
  - `src/app/management/students/page.test.tsx`
  - `src/app/management/teachers/page.test.tsx`
  - `src/app/management/vendors/page.test.tsx`
  - `src/app/management/status/page.test.tsx`
  - `tests/e2e/home.spec.ts`
- 시나리오:
  - AppShell은 공통 `수납 등록`, `출석 확인`을 기본 노출하지 않는다.
  - children 메뉴는 기본 펼침이며 toggle로 접고 펼친다.
  - `/management/*` H1은 `인원·거래처`, `/lessons/*` H1은 `레슨 시간표`다.
  - active parent children은 header 하위 탭으로 보인다.
  - lg 미만 navigation drawer와 md 이하 action drawer가 동작한다.
  - `/lessons` redirect, `/lessons/academy`, `/lessons/private` 직접 진입을 검증한다.
  - 레슨 캘린더는 현재 월을 표시하고 오늘 셀을 하이라이트한다.
  - 메모 탭에는 `관련 원생`, `관련 선생님` 선택이 있고 `메모 대상 유형`은 없다.
- 초기 실패:
  - 기존 AppShell은 horizontal/sidebar 고정 구조였고 drawer 버튼과 action slot이 없어 실패했다.
  - 기존 레슨 화면은 `/lessons` 단일 route와 내부 top-level tab 구조라 nested route/redirect 테스트가 실패했다.
  - 기존 캘린더 진입은 고정 fixture 날짜를 사용해 현재 월/오늘 하이라이트 기대와 맞지 않았다.
  - 기존 메모 폼은 대상 유형 select를 사용해 새 UX 테스트가 실패했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/app/app-shell.test.tsx src/app/page.test.tsx src/app/lessons/page.test.tsx src/features/lessons/lesson-management-workspace.test.tsx --reporter=dot` | 통과 | 4 files, 27 tests |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm test:run --reporter=dot` | 통과 | 59 files, 303 tests |
| `pnpm build` | 통과 | Next.js production build, Supabase SDK Node 20 deprecation warning만 발생 |
| `pnpm test:e2e` | 통과 | build 포함, 9 tests |
| `git diff --check` | 통과 | whitespace 문제 없음 |

## 브라우저 증거

- URL: `/`, `/lessons/academy`, `/lessons/private`, `/management/students`
- 데스크톱 스크린샷: 실행하지 않음.
- 모바일 스크린샷: 실행하지 않음.
- 비고: Playwright E2E가 주요 메뉴 이동, 레슨 하위 탭 이동, 날짜 모달의 메모 탭, route 분리를 검증한다. md 이하 action drawer와 lg 미만 navigation drawer는 `AppShell` RTL 테스트에서 `matchMedia`로 검증했다.

## Supabase 증거

- Migration: 이번 레이아웃 작업에서는 새 DB migration 없음.
- RLS 확인: 변경 없음.
- 역할별 확인: AppShell 테스트에서 owner/desk/teacher 메뉴 노출을 검증했다.
- 비고: 이전 레슨 메모 단일화 migration과 API는 유지한다.

## 품질 정리

- 코드 단순화:
  - 레슨 종류 구분을 query tab에서 route prop으로 옮겨 화면 내부 분기를 줄였다.
  - 중복 page heading과 feature 내부 action row를 AppShell action slot/fallback 패턴으로 정리했다.
  - 캘린더 오늘 계산을 `getTodayDate()`로 통일해 기본 날짜와 today highlight 기준을 맞췄다.
- 재사용한 추상화:
  - navigation SSOT의 children 구조를 sidebar, mobile drawer, header sub tab에서 함께 사용한다.
  - `PageHeaderActionsContext`, `usePageHeaderActions`, `PageHeaderActionFallback`으로 shell 내부/단독 렌더링 책임을 분리했다.
- 테스트 정리:
  - route, layout, responsive drawer, header action, 레슨 모달 UX를 사용자에게 보이는 role/label/text 중심으로 검증했다.
- 가독성:
  - `getVisibleNavigation`, `getActiveRoute`, `HeaderActions`, `SidebarNavigation`, `LessonMemoTabPanel`처럼 계산과 렌더 책임에 이름을 붙였다.
- 예측 가능성:
  - AppShell은 route 해석과 action 배치만 담당하고, dialog open state와 mutation은 feature screen이 소유한다.
  - `/lessons` legacy 진입은 화면 중복 없이 redirect만 수행한다.
- 응집도:
  - navigation/active route 계산은 AppShell 주변에, 레슨 route 선택은 lesson page wrapper에, 메모 대상 선택은 레슨 workspace 내부에 둔다.
- 결합도:
  - AppShell이 특정 feature dialog를 알지 않도록 action slot으로 연결했다.
  - mobile drawer와 desktop sidebar가 같은 filtered navigation을 받아 권한/메뉴 중복 선언을 피했다.
- simplify 결과:
  - 사용하지 않는 academyName destructuring과 memo target type 상태를 제거했다.
  - 날짜 기준을 서울 날짜 helper로 통일했다.
  - 문서에 md 이하 action drawer와 현재 학원 표시 위치 규칙을 보강했다.
- 코드 품질 리뷰:
  - Critical: 없음.
  - Warning: `pnpm build`, `pnpm test:e2e`에서 Supabase SDK가 Node.js 20 이하 지원 중단 예정 경고를 낸다. 현재 기능 실패는 아니며 런타임 업그레이드 과제로 남긴다.
  - Suggestion: 실제 모바일 viewport 스크린샷 기반 sticky/drawer 시각 검증은 추후 UI QA 단계에서 추가하면 좋다.
- 남긴 Warning/Suggestion:
  - Node 22 업그레이드 검토.
  - 모바일 시각 regression 스크린샷 추가 검토.
- 남은 부채:
  - 없음.

## 위험과 확인 질문

- 위험: md 이하 action drawer 안의 action 버튼을 누른 뒤 drawer를 자동으로 닫지는 않는다. dialog를 여는 action과 충돌하지 않게 현재는 action 소유 feature에 맡긴다.
- 후속 질문: 없음.

## Git

- 커밋: 하지 않음.
- push 여부: 하지 않음.
