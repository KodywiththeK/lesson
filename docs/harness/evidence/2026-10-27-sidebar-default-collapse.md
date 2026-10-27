# 앱셸 하위 메뉴 기본 접힘 변경 증거

## 발견 → 계획

- 요청: 왼쪽 메뉴의 하위 항목은 기본으로 감추고, 현재 경로의 하위 메뉴만 처음에 펼친다. 기존처럼 화살표 클릭으로 열고 닫으며 호버만으로는 열지 않는다.
- `AppSidebar`와 모바일 drawer는 `SidebarNavigation`을 공유했다. 기존 구현은 모든 그룹의 `isOpen`을 `true`로 시작했고 클릭으로 토글했다. 메뉴 권한·경로 선택과 스크롤 복원은 AppShell에 있었다.
- 계획: 공통 그룹의 초기 상태를 현재 자식 경로로 계산하고, 경로 변경 시 사용자 수동 펼침 상태를 초기화한다. 상위 링크의 이동 기능과 모바일 drawer 구조는 유지한다.
- 품질 목표: **가독성**은 열린 상태의 기준을 `hasActiveChild`로 드러낸다. **예측 가능성**은 호버와 클릭의 결과를 분리하고 경로 변경 때 기본 상태를 다시 계산한다. **응집도**는 펼침 상태를 그룹 안에 둔다. **결합도**는 AppShell의 경로 해석·메뉴 권한과 스크롤 저장 코드를 바꾸지 않는다. **simplify 결과**는 호버 전용 상태·이벤트와 데스크톱/모바일 분기를 제거한다.

## Red → Green → Refactor

- `src/components/layout/app-sidebar.test.tsx`에서 기본 접힘, 클릭 열기·닫기, 현재 경로 기본 펼침과 수동 닫기, 경로 변경 시 초기화, 모바일 동일 동작을 먼저 검증했다. 최초 실행은 버튼 부재와 현재 메뉴를 닫을 수 없는 상태로 4개가 의도대로 실패했다.
- `CollapsibleNavigationGroup`은 현재 자식 경로가 있으면 열림으로 시작한다. `activeHref`가 바뀌면 그룹을 다시 만들어 이전 수동 펼침을 버린다. 클릭 버튼의 `aria-expanded`와 이름은 실제 상태를 따른다.
- 작업 중 제안했던 호버 방식은 사용자 수정 지시에 따라 제거했다. 품질 검토에서 상위 링크의 중복 `aria-expanded`도 제거해, 펼침 기능을 담당하는 버튼만 상태를 알리게 했다.

## Verify

- `pnpm exec vitest run src/components/layout/app-sidebar.test.tsx src/app/app-shell.test.tsx src/app/page.test.tsx`: **3개 파일, 22개 테스트 통과**.
- `pnpm typecheck`, `pnpm lint`: 통과.
- `NEXT_PUBLIC_E2E_DEMO=1 pnpm build`: 통과.
- `pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/lesson-schedule-improvements.spec.ts`: **32개 통과**. 홈의 기본 접힘, 호버로 열리지 않음, 클릭 후 이동, 현재 페이지 기본 펼침, 모바일 메뉴와 스크롤 복원을 확인했다.
- 전체 `pnpm exec vitest run`은 호버 구현 단계에서 2150개 중 기존 홈 메뉴 기대값 1개가 실패했고, 사용자 수정 뒤 해당 테스트를 바꿔 위 대상 테스트에서 통과를 확인했다. 최종 전체 suite는 재실행하지 않았다.
- 데이터·권한·DB 스키마 변경은 없으며 Supabase 검증 대상도 없다.

## Consolidate → Evidence

- **가독성**: `hasActiveChild`로 초기 열림을 계산하고 경로 변경 시 재초기화 이유를 코드에 남겼다.
- **예측 가능성**: 클릭만 토글하고 새 경로에서는 선택된 그룹만 기본으로 연다. 상위 링크의 이동 동작은 그대로다.
- **응집도**: 펼침 상태는 `CollapsibleNavigationGroup` 안에 머물며 추가 전역 상태가 없다.
- **결합도**: AppShell의 경로 판정, 권한 필터, 스크롤 저장 구현을 수정하지 않았다.
- **simplify 결과**: 호버 상태·이벤트·화면별 펼침 모드와 중복 접근성 속성을 제거했다.
- 남은 위험: 화면 높이에 따라 접힌 메뉴에서는 스크롤할 내용이 적어질 수 있다. 작은 높이의 데스크톱과 모바일에서 기존 스크롤 복원 브라우저 테스트가 통과했다.
- 기존 온보딩 관련 스테이징 변경은 보존했다. 이번 변경은 커밋·push하지 않았다.
