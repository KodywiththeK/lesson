# 날짜·시간·금액 입력 개선 인계 계획

> **진행 상태 (2026-10-15 갱신): 완료.** 이 문서의 계획은 구현·검증을 마쳤다. 결과와 증거는 [2026-10-15-date-time-money-input.md](./evidence/2026-10-15-date-time-money-input.md)를 따른다. 아래 내용은 작업 당시의 인계 기록이며, 현재 상태 설명은 evidence가 우선한다.

## 최신 사용자 지시와 중단 상태

- 사용자는 앱 전체의 기본 브라우저 날짜·시간 입력을 빠짐없이 shadcn/ui 기반 UI로 교체하고, 월 선택도 함께 교체하길 요청했다.
- 시간은 **시와 분을 각각 선택하며 1분 단위**로 결정했다. 현재 데이터 형식은 날짜 `YYYY-MM-DD`, 월 `YYYY-MM`, 시간 `HH:mm`, 로컬 일시 `YYYY-MM-DDTHH:mm`이다.
- `140000`원이 거부되고 `140001`원이 통과하는 금액 입력 오류도 수정해야 한다.
- 기본 UI를 직접 다시 만들지 않고 shadcn/ui 컴포넌트를 우선 사용하도록 프로젝트 문서를 보강해야 한다.
- 이번 메시지에서 사용자가 **구현 중단, 현황 기록, 다음 AI용 계획서 작성**을 지시했다. 이 문서 작성 이후 추가 구현·검증·커밋·push는 하지 않는다.
- 직전 커밋은 `dc49f09 docs(quality): 수입 연동 검증과 운영 기준 기록`이다. 이번 작업은 커밋하지 않는다.

## 현재 작업 상태

- 미추적 파일은 `src/components/operations/date-time-fields.tsx`, `src/components/operations/date-time-fields.test.tsx` 두 개다. 이 문서도 미추적 파일로 남긴다. 기존 파일은 수정하지 않았다.
- 공통 초안은 shadcn `Input`, `Button`, `Popover`, `Calendar`, `NativeSelect`를 조합한 `DateField`, `TimeField`, `DateTimeField`, `MonthField`다. 아직 어떤 feature 화면에도 연결하지 않았다.
- 새 테스트를 먼저 작성하고 누락 모듈 때문에 실패하는 Red를 확인했다. 초안 구현 후 테스트 3개 중 시간·월 2개가 통과하고 날짜 1개는 테스트의 날짜 버튼 정규식 `/20/`이 여러 버튼과 일치해 실패했다. 이후 테스트 selector를 `2026년 10월 20일 화요일`로 고쳤으나 **재실행하지 않았다**.
- `pnpm lint`, `pnpm build`, 전체 테스트, 브라우저 반응형 확인은 이번 초안 이후 실행하지 않았다. 초안을 완성된 코드로 간주하지 말 것.
- 공식 shadcn/ui에는 설치 가능한 단일 `DatePicker` 또는 독립 `TimePicker` 루트가 없다. [공식 Date Picker 예시](https://ui.shadcn.com/docs/components/radix/date-picker)는 `Calendar`+`Popover` 등의 조합이다. 현재 저장소의 Radix/new-york-v4 컴포넌트와 공식 Radix 예시를 기준으로 구현한다.

## 먼저 읽을 문서와 코드

1. 최상위 `AGENTS.md`: 한국어 문서, TDD 순서, 질문 경계, 커밋·push 제한, Next.js 로컬 가이드 확인 의무.
2. `docs/harness/agent-loop.md`, `docs/harness/tdd-protocol.md`, `docs/harness/quality-consolidation.md`, `docs/harness/evidence-template.md`, `docs/harness/verification-matrix.md`: Red/Green/Verify/Consolidate/Evidence 절차.
3. `docs/engineering/code-quality.md`, `docs/engineering/shadcn-component-guide.md`, `docs/engineering/design-system.md`, `docs/engineering/architecture.md`: 코드 품질과 UI 선택 기준.
4. `docs/product/open-questions.md`, 해당 기능의 제품 문서: 날짜·시간의 도메인 의미와 미확정 정책 확인. 의미가 불분명한 UX/정책은 추측하지 말고 사용자에게 질문한다.
5. `src/components/ui/calendar.tsx`, `popover.tsx`, `input.tsx`, `native-select.tsx`, `button.tsx`, `components.json`, `package.json`: 설치된 shadcn 구성과 API.
6. `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` 및 해당 변경에 필요한 로컬 Next.js 가이드: 클라이언트 컴포넌트 경계 확인.
7. 현재 초안 `src/components/operations/date-time-fields.tsx`와 테스트를 다시 읽고 유지·수정 여부를 판단한다. 초안이므로 그대로 확산하지 않는다.

## 전체 교체 인벤토리

`rg -n 'type="(date|time|datetime-local|month)"' src --glob '*.tsx'` 결과는 **32곳**이다: `date` 17, `time` 8, `datetime-local` 4, `month` 3. 아래 9개 파일을 모두 처리한 후 같은 명령으로 0건을 확인한다.

| 화면 파일 | 위치와 종류 | 주의할 계약 |
| --- | --- | --- |
| `src/features/academy-lessons/academy-lesson-attendance-screen.tsx` | 출석 날짜 `date` 1 | 날짜 변경 callback도 유지 |
| `src/features/books/book-purchase-list-screen.tsx` | 출고일 `date` 1 | 기존 오늘 날짜 기본값 유지 |
| `src/features/private-lessons/private-lesson-registration-screen.tsx` | 시작·종료 `datetime-local` 2 | 선생님 선택 전 disabled 상태 유지 |
| `src/features/finance/finance-management-screens.tsx` | 입출금 월, 기간 시작·종료일, 발생일, 월별 조회 월, 수납·지급일: `month` 2 + `date` 4 | 조회 필터의 빈 값·reset 동작, 다이얼로그 날짜 유지 |
| `src/features/vendors/vendor-list-screen.tsx` | 등록일 `date` 1 | 등록 폼 값 유지 |
| `src/features/lessons/lesson-management-workspace.tsx` | 일정 시작·종료 `datetime-local` 2, 캘린더 월 `month` 1, 테이블 날짜·이동 날짜·보강일 `date` 3, 이동 시작·종료 `time` 2 | 모달 안 Popover, 월 이동과 선택 날짜, 일정 이동·보강 계약 |
| `src/features/students/student-list-screen.tsx` | 등록일 `date` 1, 반복 일정 시작·종료와 수정 폼 시작·종료 `time` 4 | 악기/요일별 label, 빈 시간과 저장 검증 유지 |
| `src/features/lesson-tickets/lesson-ticket-list-screen.tsx` | 유효 시작·만료일, 등록일 `date` 3 | 유효기간 검증 유지 |
| `src/features/teachers/teacher-list-screen.tsx` | 등록일·계약 시작·종료일 `date` 3, 근무요일 시작·종료 `time` 2 | 선택 안 된 요일의 disabled 상태 유지 |

다른 폴더에 새 기본 날짜·시간 입력이 생겼는지도 `rg`로 재탐색한다. 날짜처럼 보이는 일반 텍스트나 기존 레슨 캘린더 자체는 입력 컨트롤이 아니므로 무조건 교체하지 않는다.

## 금액 오류 조사 결과

- 직접 원인은 세 `Input type="number"`에 있는 `min={1}`과 `step={1000}` 조합이다. HTML step 유효값이 `1, 1001, ... 140001`이므로 `140000`이 브라우저 제약 검증에서 거부된다. JavaScript 부동소수점 오류가 아니다.
- 대상은 `src/features/books/book-purchase-list-screen.tsx`의 교재 가격, `src/features/lesson-tickets/lesson-ticket-list-screen.tsx`의 회차권 결제 금액, `src/features/finance/finance-management-screens.tsx`의 수동 입출금 금액이다.
- 세 곳 모두 1원 단위 양의 정수를 허용하도록 `step={1}`과 도메인/API의 정수 검증을 일치시킨다. `140000`의 저장 성공과 `0`·소수·음수 거부를 회귀 테스트로 고정한다.
- `rg -n 'step=|type="number"' src --glob '*.tsx'`로 나머지 숫자 입력도 감사한다. 회수·나이·비율처럼 금액이 아닌 필드를 무작정 변경하지 않는다.
- `140,000`처럼 쉼표를 **문자 그대로 입력**하는 UX까지 원하는지는 확정되지 않았다. 그 요구가 필요해지면 별도로 질문하고, 표시 포맷과 저장 숫자를 분리하는 검증 가능한 공통 금액 입력을 설계한다.

## 실행 계획

### 1. 공통 필드 완성: Red → Green

- 현재 테스트를 재실행해 selector 수정 후의 상태를 확인하고, 키보드 직접 입력/Picker 선택/disabled/빈 값/기존 값 변경/모바일 팝오버/폼 submit 검증을 추가한다.
- `DateField`는 shadcn `Calendar`+`Popover`로 날짜를 고르고, `TimeField`는 shadcn 선택 컨트롤로 시 00–23/분 00–59를 각각 고른다. `DateTimeField`는 날짜와 시간을 함께 바꾸되 로컬 일시 문자열을 보존한다. `MonthField`는 연·월을 직접 고르게 한다.
- 초안의 `DateTimeField`가 빈 날짜·시간에서 현재 날짜 또는 `00:00`을 채우는 부분, `MonthField`의 연도만 변경했을 때 값 반영 시점, 날짜 필드의 `Label`/PopoverTrigger 중첩 및 키보드 접근성, 잘못된 수기 입력과 실제 저장 검증을 리뷰한다. 정책이나 UX 선택이 불명확하면 질문한다.
- 단일 기본 UI를 새로 그리지 않는다. 서비스 도메인 조합 컴포넌트만 `src/components/operations/`에 두고 기초 부품은 `src/components/ui/`의 shadcn 소스를 사용한다.

### 2. 화면별 입력 교체: 작은 묶음마다 테스트

- 단순 `date`: 거래처·교재·출석·회차권·원생·선생님 → 재무 필터·다이얼로그 → 레슨 모달 순으로 진행한다.
- `time`과 `datetime-local`: 원생·선생님 반복 일정, 개인레슨 등록, 레슨 일정 이동·추가를 순차 교체한다.
- `month`: 레슨 캘린더, 재무 입출금 필터와 월별 조회를 교체한다.
- 각 필드의 label, value, `onChange` 의미, disabled, 기본값, validation을 유지한다. 기존 테스트는 기본 브라우저 input 구현 세부사항에 의존하는 부분만 사용자 상호작용 기준으로 수정한다. 테스트를 약화하지 않는다.
- 특히 `src/features/private-lessons/private-lesson-registration-screen.test.tsx`, `src/features/students/student-list-screen.test.tsx`, `src/features/teachers/teacher-list-screen.test.tsx`, `src/features/lessons/lesson-management-workspace.test.tsx`, `src/features/finance/finance-ledger-list-screen.test.tsx`, `src/app/integrated-demo-flow.test.tsx`, `src/app/finance/page.test.tsx`의 `getByLabelText`·`fireEvent.change`·`user.type` 가정을 확인한다.

### 3. 금액 검증 수정

- 교재·회차권·수동 입출금 폼마다 `140000`을 입력해 제출 가능한 Red 테스트를 작성한다. 실제 브라우저 `checkValidity()`와 저장 호출 양쪽을 확인한다.
- 세 필드의 `step`/정수 검증을 수정하고 기존 금액 계산·API 형식은 유지한다.

### 4. 문서 보강

- `docs/engineering/shadcn-component-guide.md`에 날짜·월·시간·일시 선택의 공식 조합 패턴, 공통 필드 위치, 1분 단위, 접근성/모바일/검증 규칙을 명확히 쓴다. "단일 DatePicker/TimePicker 설치"라고 잘못 안내하지 않는다.
- `docs/engineering/design-system.md`에 입력 컨트롤 일관성(선택기, 포맷, 오류, disabled, 반응형)을 추가한다.
- `docs/engineering/code-quality.md`와 필요 시 `AGENTS.md`에 "UI 기본 부품은 설치된 shadcn/ui 우선, 조합만 feature/shared component에서, 예외 사유 기록" 원칙을 보강한다. 기존 기준과 중복되지 않도록 간결하게 한다.
- 새 evidence를 `docs/harness/evidence/`에 한국어로 작성하고 Red/Green/Verify/Consolidate 결과와 남은 위험을 기록한다.

### 5. 검증 및 마지막 simplify

1. 관련 테스트 → `pnpm test:run --reporter=dot` → `pnpm lint` → `pnpm build` → 가능한 경우 `pnpm test:e2e`.
2. 데스크톱·모바일 브라우저에서 Popover가 Dialog/Drawer 안에서 가려지지 않는지, 320px 내외에서도 시·분 선택과 달력이 화면 밖으로 넘치지 않는지, 키보드/스크린리더 label이 동작하는지 확인한다.
3. 모든 기존 `date`/`time`/`datetime-local`/`month` input 0건, `step={1000}` 금액 필드 0건, `git diff --check`를 확인한다.
4. `docs/engineering/code-quality.md`의 가독성·예측 가능성·응집도·결합도로 diff와 테스트를 자체 리뷰한다. 공통 조합의 중복, 불명확한 이름, 날짜 파싱/포맷의 중복, UI와 도메인 검증의 혼재를 simplify하고 영향 테스트를 다시 실행한다.
5. 사용자가 명시적으로 요청하지 않는 한 커밋·push하지 않는다.

## 확인된 사용자 결정과 남은 질문 경계

- 확정: 날짜·시간뿐 아니라 월 선택도 모두 교체한다. 시간은 24시간 `HH:mm` 계약을 유지하며 시·분 각각 1분 단위 선택을 제공한다. shadcn/ui의 기존 구성요소를 사용한다.
- 미확정 사항은 임의로 정하지 않는다. 특히 빈 일시에서 Picker를 처음 열었을 때 어떤 날짜/시간으로 초기화할지, 수기 입력 허용 범위, 쉼표 포함 금액 입력 요구가 실제 제품 정책에 영향을 주면 사용자에게 질문한다.
