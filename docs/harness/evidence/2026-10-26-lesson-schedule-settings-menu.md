# 레슨시간표 설정 메뉴 이동 증거

## 발견 → 계획

- 요청: 두 레슨표에 있던 `시간표 설정` 버튼·팝업을 제거하고 `설정 → 레슨시간표` 하위 화면으로 이동한다.
- 기존 팝업은 악기 색상과 휴원일을 저장했고, 레슨표는 같은 데이터를 조회해 표시했다. 원장·데스크에게 설정 버튼이 있었으므로 새 메뉴의 쓰기 권한도 두 역할로 유지한다. 선생님은 레슨표에서 색상·휴원일을 계속 보되 설정 메뉴에는 접근하지 않는다.
- 계획: 메뉴·권한 계약을 갱신하고, 기존 폼과 저장 mutation을 설정 화면으로 옮긴다. 레슨표의 조회 query key는 유지한다. 새 migration은 필요하지 않다.
- 품질 목표: **가독성**은 설정 폼과 데이터 저장을 레슨표에서 분리해 읽는 맥락을 줄인다. **예측 가능성**은 저장 성공 후 같은 query key를 무효화하고 오류를 표시한다. **응집도**는 설정 화면의 입력과 mutation을 설정 feature에 모은다. **결합도**는 레슨표가 설정 저장 UI를 import하지 않게 한다. **simplify 결과**로 불필요한 타입 단언과 레슨표의 설정 상태·버튼·mutation을 제거한다.

## Red → Green → Refactor

- `src/domain/navigation.test.ts`, `src/domain/permissions.test.ts`, `src/app/settings/lesson-schedule/page.test.tsx`를 먼저 추가·수정했다. 최초 Vitest 실행에서 새 메뉴 경로·권한 불일치와 새 페이지 부재로 의도한 실패를 확인했다.
- `설정 → 레슨시간표` 페이지를 만들고 기존 8색/색상 선택기/휴원일 폼을 이동했다. 레슨표에서는 설정 버튼·팝업·저장 mutation만 제거했다. 공휴일·색상·휴원일 조회와 레슨 출결 흐름은 유지했다.
- 브라우저 테스트를 새 메뉴 경로로 바꾸고, `AppShell` 테스트에서 원장·데스크 메뉴를 확인했다. 조회 오류가 있으면 저장 버튼을 비활성화했다.

## Verify

- `pnpm exec vitest run src/domain/navigation.test.ts src/domain/permissions.test.ts src/app/app-shell.test.tsx src/app/settings/lesson-schedule/page.test.tsx src/features/settings/lesson-schedule-settings-form.test.tsx src/features/lessons/lesson-management-workspace.test.tsx src/lib/api/lesson-calendar-settings.test.ts`: **7개 파일, 62개 테스트 통과**.
- `pnpm typecheck`, `pnpm lint`: 통과.
- `NEXT_PUBLIC_E2E_DEMO=1 pnpm build`: 새 `/settings/lesson-schedule` 경로를 포함해 통과.
- `pnpm exec playwright test tests/e2e/lesson-schedule-improvements.spec.ts`: **3개 통과**. 데스크톱·320px 모바일에서 레슨표 버튼 제거, 설정 하위 메뉴 진입, 색상 8개·휴원 입력 표시를 확인했다. 스크린샷은 해당 Playwright 실행의 `test-results/.../private-calendar-settings-desktop.png`, `private-calendar-settings-mobile.png`에 생성됐다.
- 첫 브라우저 시도는 이전 빌드를 읽어 옛 버튼이 보였고, 두 번째 시도는 데모 환경변수 없이 빌드하여 인증 화면으로 진입했다. 데모 환경변수로 다시 빌드한 뒤 동일 테스트가 모두 통과했다.
- 이번 변경에는 DB 스키마·RLS·migration 변경이 없다. 기존 API adapter와 query key를 사용한다. 원격 Supabase 쓰기 실계정 테스트는 수행하지 않았다.

## Consolidate → Evidence

- **가독성**: 새 페이지, 설정 데이터 연결 화면, 폼으로 책임을 나눴다. 기존 폼의 필드 구조는 유지했다.
- **예측 가능성**: 기존 저장 API와 성공·실패 toast를 유지하고, 조회 실패 시 오류를 보이며 저장을 막는다. 같은 query key를 무효화하므로 레슨표 재진입 때 최신 값을 읽는다.
- **응집도**: 색상·휴원일 저장 mutation은 설정 feature에만 있다. 레슨표에는 표시용 query만 있다.
- **결합도**: 설정 화면과 레슨표는 API adapter와 query key만 공유한다. 권한은 새 feature key로 나눠 데스크의 회차권 설정 접근을 열지 않았다.
- **simplify 결과**: 더 이상 쓰지 않는 설정 dialog, 상태, 저장 mutation, icon import를 제거했고 새 화면의 불필요한 타입 단언을 제거했다.
- 변경 파일을 다시 읽고 `git diff --check`로 공백 오류를 확인했다. 기존 온보딩 관련 스테이징 변경은 수정하거나 스테이징 해제하지 않았다.
- 남은 검증 범위: 브라우저 테스트는 데모 모드이며, 실제 Supabase 계정으로 저장 후 레슨표 반영까지는 이 작업에서 재검증하지 않았다. 저장 API 및 DB 권한 계약은 기존 구현을 그대로 사용한다.
