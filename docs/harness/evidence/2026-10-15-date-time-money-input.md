# 날짜·시간·월 입력 shadcn 교체와 금액 step 오류 수정 (2026-10-15)

## 요약

- 목표: 앱 전체의 기본 브라우저 `date`/`time`/`datetime-local`/`month` 입력(9개 파일 32곳)을 shadcn/ui 조합 필드로 교체하고, `140000`원이 거부되던 금액 입력 오류를 수정한다.
- 확정 정책(사용자 결정): 시간은 시·분 각각 1분 단위 선택, 월 선택도 교체, 텍스트 직접 입력 + 선택기 버튼 병행, 빈 일시는 날짜·시·분을 모두 고를 때까지 비워 둔다. 쉼표 문자 금액 입력은 범위 밖이다.
- 완료한 변경:
  - 공통 필드 `src/components/operations/date-time-fields.tsx`(`DateField`, `TimeField`, `DateTimeField`, `MonthField`)를 완성하고 9개 화면에 연결했다. `type="date|time|datetime-local|month"` 입력은 0건이다.
  - 금액 입력 3곳(교재 가격, 회차권 결제 금액, 수동 입출금 금액)의 `step={1000}`을 `step={1}`로 고쳤다. `step={1000}`은 0건이다.
  - 문서 보강: `shadcn-component-guide.md`, `design-system.md`, `code-quality.md`, `AGENTS.md`, `decision-log.md`, `traceability-matrix.md`, 인계 문서 상태 갱신.
- 연결된 요구사항·인수 시나리오: 개인레슨 시작/종료 시간 입력과 범위 검증, 학원 일정 요일별 시간, 보강일 필수·시간 선택, 회차권 유효기간, 입출금 월·기간 필터, 교재 출고, 수동 입출금(`docs/product/acceptance-scenarios.md`). 날짜 의미·저장 형식·도메인 계산·스키마·API는 바꾸지 않았다.

## 먼저 작성한 테스트

- 테스트 파일과 초기 실패(Red, 의도한 이유로 실패 확인 후 구현):

| 테스트 | 시나리오 | 초기 실패 |
| --- | --- | --- |
| `src/components/operations/date-time-fields.test.tsx` | 존재하지 않는 값(`2026-02-30`, `24:00`, `2026-13`)을 제출 검증에서 거부, 빈 일시/시간이 날짜·시·분을 모두 고를 때까지 값을 채우지 않음, 고르다 닫으면 버림 | 7건 실패(`checkValidity`가 true, 부분 선택 시 값이 채워짐) |
| 같은 파일 | 수기 입력 중인 미완성 값은 `onValueChange`로 전달하지 않고 완성된 값만 전달(날짜·시간·월·일시) | 4건 실패(미완성 문자열이 전달됨) |
| 같은 파일 | 달력 월 드롭다운이 브라우저 언어와 무관하게 `10월`로 표시 | 실패(`en-US`에서 `Oct`) |
| `src/app/books/page.test.tsx`, `src/app/finance/page.test.tsx`, `src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx` | `expectWholeWonInput`(`src/test/expect-whole-won-input.ts`)으로 `1·1000·140000·140001` 허용, `0·-1000·1.5` 거부. 교재는 저장 버튼으로 `140000원` 출고까지 | 4건 실패(`1000원 입력의 제약 검증: expected false to be true`). 회차권은 import 누락으로 보였던 첫 실패를 step을 임시로 되돌려 진짜 Red로 재확인한 뒤 복구 |
| `src/components/operations/date-time-fields.test.tsx` | 날짜·시간·월·일시 선택기가 버튼 오른쪽 끝 기준(`data-align="end"`)으로 열림. E2E에서도 팝오버 오른쪽 끝이 버튼 오른쪽 끝을 넘지 않음 | 단위 4건 실패(`data-align`이 `start`). E2E 위치 단언은 수정과 함께 추가해 단독 Red는 확인하지 않음 |
| `tests/e2e/home.spec.ts` (데스크톱·320px) | 다이얼로그 안에서 날짜·일시 선택기를 실제 클릭으로 선택 | 2건 실패: Dialog(`z-[60]`)가 Popover(`z-50`) 클릭을 가로챔(`subtree intercepts pointer events`) |

- 기존 테스트는 약화하지 않았다. 기존 화면 테스트(`getByLabelText("유효 시작일")` + `fireEvent.change`/`user.type`)는 텍스트 입력 + `aria-label` 유지 설계 덕분에 수정 없이 통과한다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm typecheck` | 통과 | 필수 `aria-label` 누락 3곳(레슨 이동 다이얼로그)을 타입이 잡아 `이동 날짜`·`시작 시간`·`종료 시간`으로 부여 |
| `pnpm lint` | 통과 | |
| `pnpm test:run --reporter=dot` | 61개 파일, 375개 통과 | 변경 전 341개 → 공통 필드 30 + 금액 4 추가 |
| `pnpm test:e2e` (webpack 빌드 포함) | 12개 통과 | 기존 10 + 신규 2. 별도 `pnpm build`는 e2e의 `next build --webpack`으로 대체 확인 |
| `git diff --check` | 통과 | |
| `rg 'type="(date\|time\|datetime-local\|month)"' src` | 0건 | 변경 전 32곳 |
| `rg 'step=\{1000\}' src` | 0건 | 변경 전 3곳 |

## 브라우저 증거

- URL: `/finance/ledger`(수동 입출금 다이얼로그, 월 선택), `/lessons/academy`(학원 일정 추가 다이얼로그의 일시 선택). 데모 빌드를 `127.0.0.1:3107`에서 실행해 Playwright Chromium으로 확인했다(20개 항목 PASS).
- 데스크톱 1280×800: 다이얼로그 안 달력이 화면 안·최상단에 표시, 날짜 선택 후 달력만 닫히고 다이얼로그 유지, Tab+Enter로 열고 Escape로 달력만 닫힘, 월 선택기 정상, 실제 브라우저 `checkValidity()`로 `140000` 유효.
- 모바일 320×640: 달력·월 선택기·일시(달력+시·분) 선택기가 모두 화면 폭 안에 들어오고 문서 가로 스크롤이 없다.
- 스크린샷: `/private/tmp/claude-501/-Users-kody-Desktop-Kody-projects-mingyu/133ee8eb-d2d9-418e-ab9a-dbcf98a49607/scratchpad/desktop-dialog-calendar.png`, `.../mobile320-datetime.png`, `.../mobile320-month.png` (임시 경로, 저장소 밖).
- 브라우저에서만 드러난 문제 2건: Dialog 뒤에 깔리는 Popover(`z-[70]`로 수정), 월 드롭다운 영어 표기(`formatMonthDropdown`으로 한국어화). 둘 다 jsdom 단위 테스트로는 잡히지 않았다.

## Supabase 증거

- 변경 없음. 스키마·RLS·migration·API를 수정하지 않았다(화면 입력 컴포넌트와 폼 `step`만 변경).

## 품질 정리

- 코드 단순화: `FieldInput`의 아이콘 버튼 라벨 삼항을 `FIELD_KINDS` 매핑으로, 흩어진 날짜 파싱을 `parseDate` 한 곳으로 모았다. `PopoverTrigger`가 `Popover` 자식 위치에 암묵 의존하던 구조를 `PickerField`(트리거·입력·패널을 한 컴포넌트가 소유)로 바꿨다. 선택 도중 값은 `useDraftParts`로 모으고 패널이 열릴 때마다 새로 마운트되어 닫으면 자동으로 버려진다.
- 재사용한 추상화: shadcn `Input`, `Button`, `Popover`, `Calendar`, `NativeSelect`와 기존 `date-fns`/`react-day-picker`. 새 기본 부품이나 의존성은 추가하지 않았다. `NativeSelect`는 시(24)·분(60)·연도처럼 옵션이 많지만 검색이 필요 없는 단순 선택이고 모바일에서 네이티브 휠을 쓸 수 있어 선택했다.
- 테스트 정리: 금액 정책 검증을 `expectWholeWonInput` 하나로 모아 세 화면이 같은 기준을 쓰게 했다(같은 정책이 함께 바뀌므로 공통화). 필드 테스트는 role/label/visible text와 사용자 상호작용 기준이며, Date 시계는 `vi.useFakeTimers({ toFake: ["Date"] })`로 고정한다.
- 가독성: 아이콘·placeholder·오류 문구·검증을 종류별 매핑에 이름 붙여 두었고 중첩 삼항이 없다. 정책 상수(`YEAR_RANGE`, `PICKER_CONTENT_CLASS_NAME` 등)에 이름을 붙였다.
- 예측 가능성: `onValueChange`는 완성된 유효 값 또는 빈 문자열만 전달한다. 입력 중 미완성 값은 필드 안에만 있고, 유효하지 않으면 `aria-invalid`와 `setCustomValidity`로 제출을 막는다. 빈 일시에 오늘 날짜/`00:00`을 임의로 채우지 않는다. 달력은 이미 선택된 날짜를 다시 눌러도 해제되지 않는다(`required`).
- 응집도: 형식 검증·포맷·선택기 UI는 한 파일에 있고, 시작<종료·유효기간 같은 의미 검증은 기존대로 각 화면/도메인에 남겼다. 금액 `step` 정책은 문서(code-quality, shadcn 가이드)와 테스트 helper에 함께 기록했다.
- 결합도: 화면은 `value`/`onValueChange`/`aria-label`만 알면 되고 `event.target.value`에 의존하지 않는다. `aria-label`은 필수 prop이라 접근 가능한 이름 누락을 타입이 막는다. 필드는 도메인 모듈을 import하지 않는다.
- simplify 결과: 초안의 중복(`DateTimeField`/`DateField` 달력 설정, 시간 선택 중복 구현)을 `DateCalendar`·`TimeSelects`로 합쳤고, 월 선택기의 `onOpenChange` 연도 초기화 훅을 제거했다(패널 remount로 대체). 불필요한 `key`(달력 월 재설정)와 `pattern` 속성을 제거했다. 변경 후 전체 테스트·타입·lint·E2E를 다시 실행했다.
- 코드 품질 리뷰: Critical 없음. 브라우저에서 발견한 Dialog 뒤 Popover(클릭 불가)와 미완성 값 전파(레슨 캘린더 `new Date`/`Intl.format` 예외 위험)는 모두 수정했다.
- 남긴 Warning/Suggestion:
  - Warning: 수기 입력 중에는 미완성 값도 즉시 invalid 스타일로 표시된다. 포커스 이탈 후 표시하는 개선은 UX 결정이 필요해 남긴다.
  - Warning: `src/components/operations/list-toolbar.tsx`의 `<input type="search">`는 shadcn `Input`이 아닌 기존 raw 입력이다. 날짜 범위 밖이라 변경하지 않았다.
  - Warning: 선택기 `z-[70]`은 Dialog `z-[60]`과의 결합이다. Dialog z-index를 바꾸면 함께 확인해야 하며 `design-system.md`에 기록했다. AlertDialog(`z-[70]`/`z-[80]`) 안에서 선택기를 열지 않는 것이 전제다.
  - Suggestion: `finance-management-screens.tsx`는 여전히 한 파일에 하위 화면이 모여 있다(선행 evidence의 Warning). 이번 변경은 입력 교체로 한정했다.
- 남은 부채: 쉼표 문자 금액 입력(`140,000`) UX는 미확정이라 구현하지 않았다.

## 위험과 확인 질문

- 위험: 모바일에서 `NativeSelect` 시·분은 OS 네이티브 휠이 열린다. Chromium에서는 확인했지만 iOS Safari/Android 실기기 확인은 하지 못했다.
- 위험: 시·분을 모두 고르기 전까지 일시/시간 값은 비어 있으므로, 사용자가 날짜만 고르고 닫으면 값이 저장되지 않는다(확정된 정책의 결과이며 필수 필드는 기존 저장 검증이 막는다).
- 운영 사고 기록: 검증 정리 중 `pkill -f next-server`가 사용자가 띄워 둔 `127.0.0.1:3108` dev 서버를 종료했다. 같은 명령(`next dev --hostname 127.0.0.1 --port 3108`)으로 즉시 재시작해 응답 200을 확인했다. 이후 임시 서버는 PID 지정으로만 종료했다.
- 후속 질문: 쉼표 포함 금액 입력 요구 여부, 입력 중 invalid 표시 시점.

## Git

- 커밋: 하지 않음.
- push 여부: 하지 않음.
- 제안 커밋 분리(요청 시): `feat(ui): 날짜·시간·월 입력을 shadcn 필드로 교체`, `fix(finance): 금액 입력 step을 1원 단위로 수정`, `docs(engineering): 날짜·시간 입력과 금액 기준 기록`.
