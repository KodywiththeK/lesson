# UI 디자인 시스템 정비 1단계: 토큰·폰트·ui 부품

## 요약

- 목표: 레퍼런스(Lingora·MyCloud)처럼 깔끔한 블루 계열로 디자인 토큰과 shadcn ui 부품 스타일을 정비한다. 비즈니스 로직은 건드리지 않는 스타일 전용 작업이다.
- 계획: `~/.claude/plans/valiant-puzzling-cosmos.md`의 4단계 중 1단계. 사용자 결정은 블루 메인, 플로팅 카드형 셸, 부드러운 radius, Pretendard, 라이트 전용, 상태 색 토큰과 Badge variant 추가다.
- 이 단계에서는 앱 셸(사이드바·헤더), 공용 컴포넌트 추출, 화면별 적용을 하지 않았다. 각각 2·3·4단계다.

## 변경 내용

- `src/app/globals.css`
  - 색을 모두 oklch로 통일하고 사이드바 hsl을 제거했다. 바탕은 연한 하늘색, 카드는 흰색, primary는 블루다.
  - 상태 토큰 `success`, `warning`, `info`, `destructive`에 `-foreground`, `-soft`, `-soft-foreground`를 추가했다. 차트 `--chart-1~5`를 추가했다.
  - `--total`을 남보라 계열로 옮겨 primary 파랑과 구분했다. `--income`, `--expense` 값과 세 토큰의 이름은 그대로다.
  - radius 단계를 `sm 8 / md 10 / lg 12 / xl 16 / 2xl 20px`로 정의하고, 파란 기운의 얕고 넓은 그림자 토큰(`shadow-xs~lg`, `shadow-card`)을 추가했다.
  - 본문 글꼴을 `--font-sans`로 지정하고 자간 `-0.01em`을 적용했다. 반응형 표 카드의 하드코딩 `6px`를 `var(--radius-lg)`로 바꿨다. 브레이크포인트는 바꾸지 않았다.
- `src/app/layout.tsx`, `src/app/fonts/PretendardVariable.woff2`: Pretendard Variable(2.0MB, SIL OFL 1.1, npm `pretendard@1.3.9`)을 `next/font/local`로 포함했다. 외부 CDN은 쓰지 않는다.
- `src/components/ui/`
  - Button: 높이 `h-10`(sm `h-9`, xs `h-7`)과 부드러운 hover·active, `success` variant 추가.
  - Badge: `default`는 연한 파랑, `destructive`는 연한 빨강 배경으로 바꾸고 `success`, `warning`, `info` variant를 추가했다.
  - Input·Textarea·Select·NativeSelect: 흰 배경, `h-10`, 부드러운 focus ring으로 통일했다.
  - Card: `rounded-xl`과 `shadow-card`. Table: 헤더 `bg-muted/60`·`text-muted-foreground`, 기본 셀 `px-4 py-3`, 행 hover `accent`. Tabs: 활성 항목 흰 배경과 primary 글자.
  - Dialog·AlertDialog·Sheet·Drawer: 배경을 `bg-card`로, 오버레이를 `bg-foreground/40`으로 바꿨다. Dialog·AlertDialog는 `rounded-2xl`이다.
  - Popover·DropdownMenu·SelectContent·Alert는 radius 단계를 올렸고, Switch 손잡이·Calendar·Chart 툴팁은 `bg-card`로 맞췄다.
- `docs/engineering/design-system.md`: 토큰 절을 색·모서리·그림자·글꼴·크기 표로 다시 썼다.

## 범위에서 제외하거나 바꾸지 않은 항목

- Dialog의 sr-only "Close"를 "닫기"로 바꾸는 계획은 보류했다. 12곳 이상의 테스트가 "Close" 이름으로 버튼을 찾고, 별도 "닫기" 버튼이 있는 다이얼로그에서 이름이 겹친다. 문구 변경은 스타일이 아니므로 별도 작업으로 다룬다.
- `alert-dialog.tsx`의 z-index와 인라인 `zIndex`는 `alert-dialog.test.tsx`가 고정하고 있어 그대로 두었다.
- 테스트와 반응형 표 CSS가 쓰는 `data-responsive-table`, `data-slot`, `data-label`, 브레이크포인트(1024·768·481·480)는 유지했다.

## 연결된 요구사항

- 기능 요구사항 변경 없음. `docs/engineering/design-system.md`의 반응형 표 기준, 금액 의미 색 규칙(`text-total/income/expense`), shadcn 우선 규칙을 그대로 지켰다.
- 인수 시나리오: 기존 화면의 동작과 접근 가능한 이름이 그대로여야 한다. 기존 Vitest 1,876개와 e2e 20개가 인수 기준이다.

## 먼저 작성한 테스트

스타일 전용 변경이라 새 동작 테스트는 만들지 않고, 기존 테스트를 회귀 안전망으로 썼다. 동작이 달라지는 지점이 없어 Red 단계에서 실패시킬 테스트가 없다. 클래스에 묶인 단언은 계획대로 이후 단계에서 동작 기준으로 바꾼다. 이번 단계에서는 깨진 단언이 없었다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | |
| `pnpm test:run` | 159개 파일·1,876개 테스트 통과 | 변경 전과 같은 개수 |
| `pnpm test:e2e` | 20개 통과 | 데모 production build 포함. 반응형 표, 320px 다이얼로그, 가로 넘침 검사 포함 |
| 색 대비 계산(oklch→sRGB) | 통과 | 본문 16.0, 보조 글자 6.0, primary 5.2, success·warning·info·destructive 채움 4.7~5.1, soft 6.5~7.4, 금액 색 5.3~7.6 |
| 폰트 적용 확인 | 통과 | 데모 빌드에서 `document.fonts.check("16px Pretendard")`가 true |

## 브라우저 증거

- 데모 빌드를 `next start -p 3107`로 띄워 1280px·390px에서 `/`, `/management/students`, `/finance/overview`를 열었다. 1280px의 원생 목록과 수입 전체 화면 스크린샷을 직접 확인했다.
- 확인한 것: 하늘색 바탕 위의 흰 카드, 10~16px 모서리, 흰색 입력, 파란 primary 버튼과 페이지 번호, 활성 탭의 연한 파랑 강조, 합계 금액의 남보라와 수입·지출 색 구분.
- 스크린샷 파일은 세션 임시 폴더에만 두었고 저장소에는 넣지 않았다. 390px 화면은 촬영했지만 이번에는 직접 확인하지 않았다. 반응형 동작은 e2e로 검증했다.
- 사이드바와 헤더는 2단계 전이라 이전 구조 그대로다.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다.

## Quality Consolidation

- 가독성: 색 용도를 `background/card/primary/accent/상태 4종`의 이름으로만 쓰게 했다. 팔레트 색이나 hex를 새로 도입하지 않았다. 토큰 표는 `design-system.md`에 두었다.
- 예측 가능성: 모든 컨트롤이 `h-10`·`h-9`·`h-7` 세 단계로 맞아 툴바 안에서 높이가 어긋나지 않는다. Badge variant 이름은 기존 것을 유지하고 추가만 했다.
- 응집도: 색·radius·그림자 값이 `globals.css` 한 곳에 있고 컴포넌트는 의미 이름만 참조한다. 이전에 컴포넌트마다 흩어져 있던 `rounded-md/lg`, `shadow-sm` 선택은 토큰 단계로 모았다.
- 결합도: 컴포넌트가 서로의 스타일을 알지 못하고 토큰만 공유한다. 반응형 표 CSS와 `Table` 컴포넌트의 `data-*` 계약은 그대로다.
- simplify 결과: 변경 파일을 다시 읽어 Button의 `transition-all`을 필요한 속성만 전환하도록 줄였다. 다크모드 variant 클래스는 shadcn 원본과의 차이를 키우지 않으려고 남겼다. 라이트 전용이라 화면에는 영향이 없다.
- Warning(남김): 2.0MB 폰트가 전 페이지에서 preload된다. 사내 데스크 환경이라 허용했으나, 느린 모바일 회선에서는 첫 로드가 길어질 수 있다. 문제가 보이면 subset 파일로 교체한다.
- Warning(남김): Badge `default`가 채움 파랑에서 연한 파랑으로, `destructive`가 채움 빨강에서 연한 빨강으로 바뀌어 강조가 약해졌다. 화면별로 더 강한 표시가 필요하면 4단계에서 확인한다.

## 남은 위험 또는 미확정 질문

- 2단계에서 앱 셸 구조(사이드바·헤더·드로어)를 플로팅 카드형으로 바꾼다. 그 전에는 사이드바가 화면 왼쪽에 붙은 이전 모양이다.
- 위 두 Warning과 Dialog "Close" 문구 변경 여부를 사용자와 정해야 한다.
