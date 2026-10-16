# 코드 품질 기준

이 문서는 이 repo의 코드 품질 SSOT다. Frontend Fundamentals의 기준을 이 프로젝트의 Next.js, Supabase, TDD, 운영 관리자 앱 맥락으로 옮겨 적은 내부 기준이므로, 매 작업마다 옆 repo를 다시 열지 말고 이 문서를 기준으로 판단한다.

좋은 코드는 운영 중 요구사항을 바꾸고, 검증하고, 배포하기 쉬운 코드다. 모든 구현은 **가독성**, **예측 가능성**, **응집도**, **결합도** 네 축으로 검토한다.

## 작업 전 기준

- 구현 전 관련 제품/엔지니어링/하네스 문서를 먼저 읽고, 이번 변경에서 적용할 코드 품질 기준을 이 문서에서 확인한다.
- 제품 정책, 민감 권한, 급여/결제 해석, 스키마 영향, 파괴적 데이터 작업, 기술스택 변경, UX 의사결정이 불명확하면 추론하지 않고 사용자에게 질문한다.
- 새 코드가 들어갈 위치는 “함께 수정되는 코드가 가까이 있는가”를 기준으로 정한다.
- UI가 들고 있는 비즈니스 규칙은 도메인 함수, API adapter, server boundary로 옮길 수 있는지 먼저 판단한다.

## 가독성

- 한 함수나 컴포넌트에서 한 번에 읽어야 하는 맥락을 줄인다.
- 동시에 실행되지 않는 분기는 한 컴포넌트 안에 섞지 말고, 분기별 컴포넌트나 함수로 나눈다.
- 복잡한 조건식은 `canSubmit`, `isArchivedStudent`, `hasVisibleChildren`처럼 제품 언어를 담은 이름을 붙인다.
- 중첩 삼항 연산자는 사용하지 않는다. 둘 이상의 조건이 얽히면 `if`, early return, 명명된 helper를 사용한다.
- 매직 넘버와 매직 문자열은 의미 있는 상수로 이름 붙인다. 단, 한 번 쓰이는 명백한 UI 숫자는 과도하게 분리하지 않는다.
- 파일은 위에서 아래로 자연스럽게 읽히게 둔다. 공개 컴포넌트, 주요 계산, 세부 렌더 helper 순서를 기본으로 한다.
- 주석으로 나쁜 코드를 설명하지 않는다. 먼저 이름, 함수 분리, 타입으로 의도를 드러낸다.

## 예측 가능성

- 함수, hook, 컴포넌트 이름은 실제 동작과 일치해야 한다.
- `get*`, `build*`, `calculate*`는 숨은 저장, 로깅, toast, navigation 같은 side effect를 만들지 않는다.
- side effect가 필요하면 호출부에 드러내거나 `save*`, `track*`, `redirect*`, `mutate*`처럼 이름에 드러낸다.
- 같은 종류의 API adapter, query option factory, validator는 반환 타입을 통일한다.
- 실패 가능한 도메인 검증은 boolean과 object를 섞지 않고, 필요한 경우 `{ ok: true } | { ok: false; reason: string }` 같은 명시적 결과를 사용한다.
- 외부 라이브러리나 전역 객체와 같은 이름을 프로젝트 서비스 이름으로 재사용하지 않는다.
- 테스트도 예측 가능해야 한다. hidden global state에 기대지 말고 결정적인 fixture와 사용자에게 보이는 role, label, text를 사용한다.

## 응집도

- 함께 수정되는 파일은 같은 feature/domain 근처에 둔다.
- 특정 화면에서만 쓰는 hook, type, helper는 전역 공용 폴더로 올리지 않는다.
- 여러 화면에서 같은 정책이 반드시 함께 바뀌어야 할 때만 공통화한다.
- 같은 상수나 정책 값이 세 곳 이상 반복되고 함께 바뀌어야 하면 공유 상수로 추출한다.
- 폼은 필드 단위 검증과 폼 전체 검증의 경계를 명확히 둔다.
- 도메인 규칙은 UI 이벤트 핸들러 안에 흩뜨리지 않고 `src/domain` 또는 feature 내부 순수 함수로 모은다.
- query key, route, permission feature처럼 앱 전체 계약이 되는 값은 한 곳을 source of truth로 둔다.

## 결합도

- 한 변경이 관련 없는 기능을 깨뜨리지 않도록 영향 범위를 작게 둔다.
- props가 세 계층 이상 단순 전달되면 조합 패턴, 가까운 컴포넌트 배치, 필요한 경우 제한된 context를 검토한다.
- 하나의 hook이 많은 상태, query, mutation, UI action을 한꺼번에 반환하면 책임별 hook이나 컴포넌트로 나눈다.
- 공통 컴포넌트는 실제로 같은 책임과 같은 변경 주기를 가질 때만 만든다.
- 페이지마다 달라질 가능성이 큰 5줄 이하의 단순 중복은 공통화하지 않아도 된다.
- 전역 context는 인증, 테마, 로케일처럼 진짜 전역 관심사에만 사용한다.
- utility가 여러 도메인에서 무분별하게 import되면 위치와 책임을 다시 검토한다.

## 운영 앱 코드 기준

- 수업, 출석, 회차권, 수납, 미납, 교재, 급여처럼 운영 데이터에 영향을 주는 로직은 테스트 가능한 순수 함수나 서버/API 경계에 둔다.
- Supabase service-role key, 권한 판단, tenant isolation은 브라우저 UI 코드에 의존하지 않는다.
- navigation, permission, query key, route redirect는 중복 선언을 줄이고 하나의 계약을 기준으로 한다.
- 사용자-facing UI는 접근 가능한 role, label, visible text가 먼저이며 test id는 마지막 수단이다.
- 모바일과 데스크톱에서 같은 정보 구조를 유지하되, 레이아웃만 화면 폭에 맞게 바꾼다.

## 작업 상황별 적용 기준

### 새 화면 또는 컴포넌트

- 화면 컴포넌트는 데이터 조회, 이벤트 핸들러, 렌더링 구조가 한눈에 나뉘어야 한다.
- 역할이나 상태에 따라 동시에 실행되지 않는 UI는 작은 컴포넌트로 분리한다.
- 버튼, 링크, 입력 필드는 접근 가능한 이름을 가져야 하며 테스트도 role/label/text 기준으로 작성한다.
- 모바일/데스크톱 반응형 차이는 class와 레이아웃 책임으로 제한하고, 데이터 구조를 화면 폭마다 다르게 만들지 않는다.

### 사용자 메시지

- 사용자 화면에 보이는 오류는 `toUserMessage`(`src/lib/errors/user-message.ts`)를 거친다. `error.message`나 `String(error)`를 그대로 보여주지 않는다. 영문 RPC 예외·PostgREST 원문·내부 용어(`Supabase client`, `환경변수`)는 "무엇이 문제이고 어떻게 하면 되는지"를 말하는 한국어로 바꾼다. 새 영문 예외가 생기면 변환 규칙과 테스트를 함께 추가한다.
- 삭제처럼 되돌리기 어려운 동작은 `AlertDialog` 확인을 거치고 처리 중에는 중복 클릭을 막는다. 브라우저 `window.confirm`은 쓰지 않는다.
- 성공 문구는 실제 결과를 말한다(예: 이미 출석 처리된 수업은 "차감했습니다"라고 하지 않는다, 복사에 실패하면 성공이라고 하지 않는다).

### 폼과 다이얼로그

- UI 기본 부품(input, select, popover, calendar, dialog 등)은 설치된 shadcn/ui(`src/components/ui/`)를 먼저 쓰고, 도메인에 맞춘 조합만 `src/components/operations/`·`management/`나 feature 안에 둔다. 기본 HTML 요소나 브라우저 기본 입력(`type="date|time|datetime-local|month"`)을 쓰는 예외는 이유를 evidence에 기록한다.
- 날짜·월·시간·일시 입력은 `src/components/operations/date-time-fields.tsx`의 공통 필드를 쓴다. 필드는 형식만 책임지고 시작<종료 같은 의미 검증은 화면의 도메인 helper에 둔다.
- 원 단위 금액 `type="number"`는 `step={1}`을 사용하고 `min`은 도메인 정책에 맞춘다(필수 결제 `1`, 선택형 0원 등록 `0`). `step`은 허용 간격이 아니라 `min` 기준 유효값 격자라 `step={1000}`은 `140000`을 거부한다.
- 단일 필드 검증은 필드 가까이에 둔다.
- 여러 필드 조합 검증은 schema 또는 도메인 helper로 모은다.
- submit handler는 입력 수집, 검증, mutation, toast/navigation을 읽기 쉬운 순서로 분리한다.
- 저장/수정/삭제 mutation의 성공/실패 반환 형태와 에러 메시지 규칙은 같은 종류끼리 맞춘다.

### 목록, 필터, 검색

- 목록의 반응형 표는 `src/components/ui/table.tsx`의 shadcn `Table`과 `docs/engineering/design-system.md`의 표 규칙을 사용한다. 같은 row를 폭마다 다시 조회·변환·mutation하지 않고, `TableCell label`과 CSS로 표시만 바꾼다.
- 데스크톱 표, 태블릿 세미테이블, 모바일 카드에서 필드·상태·액션이 동등한지 테스트한다. 숨긴 열이나 가로 스크롤 때문에 업무상 중요한 값이 사라지면 완료로 보지 않는다.
- 검색/필터/정렬 규칙은 UI state가 아니라 테스트 가능한 pure function 또는 query adapter에서 표현한다.
- query key는 학원 scope와 필터 값을 포함하고, 같은 종류의 query key 형태를 통일한다.
- 페이지마다 다르게 발전할 가능성이 큰 목록 UI는 성급하게 공통화하지 않는다.
- 공통 list control은 실제로 같은 상호작용, 같은 접근성 요구, 같은 변경 주기를 가질 때만 확장한다. 페이지 상태·총 건수·번호 이동·페이지 크기는 `useListPaging`과 `ListPagination`(`src/components/management/`)을 쓰고, 이미 정렬된 목록을 자를 때는 `paginateItems`(`src/domain/common-list.ts`)를 쓴다. 화면마다 자체 페이지 UI나 자르기 로직을 만들지 않는다.
- 이름 정렬은 `compareKoreanNames`/`buildListView`로 통일하고, 동명이인은 `getTieBreaker`(id)로 순서를 고정한다. `localeCompare("ko…")`를 화면마다 쓰지 않는다. 이름 없는 시간순 표만 예외다.
- **드롭다운 후보와 급여 계산처럼 대상 전체가 필요한 조회는 페이지 목록 조회를 재사용하지 않는다.** 전용 조회(`fetchTeacherOptions`, `fetchStudentOptions`, `fetchAllLessonTickets`)와 별도 query key(`queryKeys.*.options`)를 쓴다. 페이지로 잘린 데이터로 합계·계산을 만들지 않는다.
- 필터 선택지는 현재 페이지·현재 필터 결과가 아니라 전체 데이터나 고정 목록에서 계산한다.
- 목록 화면은 검색어·필터·페이지 크기가 바뀌는 모든 핸들러에서 1페이지로 되돌린다.

### 권한, 메뉴, route

- 권한 판단은 UI 표시와 서버/API 보호를 분리해서 생각한다.
- navigation, permission feature, route path는 중복 선언을 줄이고 한 곳을 기준으로 삼는다.
- 메뉴 숨김은 보안 경계가 아니다. 민감 데이터는 Supabase RLS, server boundary, API adapter에서 다시 보호한다.
- legacy route는 얇은 redirect로 유지하고, 실제 화면 로직을 중복하지 않는다.

### 레이아웃, 페이지, action

- 전역 레이아웃은 정보 구조, 현재 route 해석, 공통 shell 배치, header action slot만 책임진다.
- 페이지별 등록/저장/조회 action의 open state와 mutation은 해당 feature screen이 소유한다.
- feature screen이 AppShell 안에서 렌더되면 header action slot에 primary action을 등록하고, 단독 렌더 테스트나 임베드 화면에서는 local fallback action row를 사용한다.
- 같은 페이지명을 AppShell H1과 feature 내부 heading에 중복 표시하지 않는다. 자식 route는 상위 메뉴명을 H1로, 자식 구분은 header 하위 탭 링크로 표현한다.
- 하위 메뉴 route는 query string 탭보다 명시적 nested route를 우선한다. 이전 route가 필요하면 실제 화면을 중복하지 말고 redirect만 둔다.
- 데스크톱 navigation은 sticky sidebar로, lg 미만 navigation은 header의 메뉴 버튼이 여는 drawer로 제공한다. 두 레이아웃은 같은 navigation SSOT와 권한 필터 결과를 재사용한다.
- 현재 학원처럼 전역 문맥을 설명하는 정보는 navigation shell/sidebar/drawer에 두고, 페이지 header에는 현재 페이지 제목과 action만 둔다.
- md 이하에서 페이지 action이 하나 이상이면 header에 모두 펼치지 않고, `작업` 메뉴나 drawer 안에 모아 좁은 화면의 제목 영역을 보존한다.
- sticky header/sidebar는 콘텐츠를 가리지 않도록 배경, z-index, 스크롤 컨테이너를 함께 설계한다.

### Supabase와 API adapter

- service-role key와 민감 권한 판단은 브라우저 코드에 두지 않는다.
- API adapter는 row 변환, query builder, 에러 메시지 책임을 명확히 나눈다.
- 같은 종류의 fetch/create/update/delete 함수는 반환 타입과 에러 형식을 맞춘다.
- DB schema나 RLS 의미가 불확실하면 구현하지 말고 사용자에게 질문한다.
- 원장, 수납, 급여처럼 돈의 흐름을 바꾸는 테이블은 수정/삭제 권한을 열 때 audit 기록을 같은 migration에 포함한다.
- 자동 생성 row와 수동 입력 row는 `source`, `category`, `ref_id` 같은 추적 필드로 구분하고, UI에서 임의 추론하지 않는다.

### 도메인 로직

- 출석, 결석, 보강, 패스, 회차권, 수납, 미납, 교재, 급여 계산은 UI 밖에서 테스트 가능한 함수로 둔다.
- 날짜, 금액, 보관 기간, 차감 횟수 같은 정책 값은 이름 있는 상수로 둔다.
- 계산 함수는 저장하지 않는다. 저장이 필요하면 계산과 mutation을 분리하거나 이름에 명시한다.
- 제품 정책이 확정되지 않은 계산 기준은 임의로 가정하지 않는다.

### 수입 관리와 금전 데이터

- `ledger_entries`는 사업자 통장 기준 입출금의 source of truth다. 화면별 수입/지출 요약은 이 원장을 기준으로 재계산한다.
- 출고·수납·급여처럼 원천 상태와 원장 행이 함께 확정되어야 하는 작업은 하나의 DB 트랜잭션/RPC로 묶는다. 브라우저에서 순서대로 여러 insert를 호출해 부분 저장이 가능하게 두지 않는다.
- 생성된 월수강료·급여 정산 행은 당시 금액과 지급 상태의 스냅샷이다. 재조회나 원생/선생님 설정 변경으로 기존 행을 묵시적으로 덮어쓰지 않는다.
- 금전 상태가 `paid`인 행은 연결 원장 ID 또는 원천 ID를 통한 역참조로 대조할 수 있어야 한다. 과거 데이터 보정은 중복 방지 조건과 보정 전후 건수 검증을 포함한다.
- 수강료, 회차권, 교재판매, 급여처럼 원천 데이터에서 자동 생성되는 내역은 원천 row와 원장 row를 연결할 수 있어야 한다.
- 수동 입출금은 사용자가 직접 등록/수정/삭제할 수 있지만, 수정/삭제 가능성은 audit과 함께 설계한다.
- 고정 분류는 도메인 상수로 관리하고 필터, CSV, 화면 표시가 같은 상수를 사용한다.
- 월수강료, 회차권 결제금액, 급여 세금 같은 계산은 UI 컴포넌트가 직접 만들지 말고 `src/domain` 함수나 API adapter 계약으로 둔다.
- CSV 같은 export는 현재 화면의 필터/정렬 결과를 기준으로 생성하고, 컬럼 순서와 라벨은 테스트로 고정한다.
- 운영 화면의 날짜 기본값은 고정 예시 날짜가 아닌 학원 기준 현재 날짜로 잡는다. 날짜 의존 테스트는 테스트 시계를 명시적으로 고정하고 종료 시 복원한다.
- 예시 건수·금액을 실시간 운영 현황처럼 표시하지 않는다. 연결되지 않은 현황은 실제 조회로 대체하거나 예시임을 구분한다.

### 테스트

- 테스트 이름은 실패했을 때 깨진 요구사항을 설명해야 한다.
- UI 테스트는 구현 세부 class보다 사용자가 보는 role, label, text를 우선한다.
- 테스트 fixture는 결정적으로 만들고 숨은 전역 상태에 기대지 않는다.
- 리팩터링 후에는 영향 받은 테스트를 다시 실행한다.

## 품질 리뷰 절차

작업 마지막에는 변경 diff를 다음 형식으로 자체 리뷰한다.

- Critical: 운영 버그, 권한 누락, 데이터 손상, 테스트 공백, 심각한 결합도 증가
- Warning: 가독성 저하, 예측 어려운 이름/side effect, 공통화 또는 중복 판단이 불명확한 코드
- Suggestion: 더 읽기 쉬운 이름, 더 가까운 파일 배치, 작은 helper 추출 같은 개선 후보

Critical은 완료 전 수정한다. Warning은 가능하면 수정하고, 남기면 evidence에 이유를 기록한다. Suggestion은 현재 작업 범위 안에서 효과가 분명할 때만 반영한다.

## 마지막 simplify 필수 규칙

- 테스트가 통과한 뒤 바로 완료하지 말고 변경 파일을 다시 읽어 중복, 불명확한 이름, 숨은 side effect, 불필요한 props, UI/비즈니스 로직 혼재를 줄인다.
- 계획과 evidence에는 `가독성`, `예측 가능성`, `응집도`, `결합도`, `simplify 결과`를 반드시 남긴다.
- 공통화는 반복 횟수만 보지 않는다. 같은 책임과 변경 주기가 확인될 때만 추출한다.
- simplify 후 영향 받은 테스트를 다시 실행하고, 실행하지 못한 검증은 이유를 evidence와 최종 응답에 적는다.
