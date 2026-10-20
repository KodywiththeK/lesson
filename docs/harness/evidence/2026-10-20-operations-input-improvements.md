# 운영 화면·입력 흐름 개선 증거

## 요약

- 목표: 레슨 달력, 원생 입력, 교재 발주, 수입 연동, 금액·시간 입력을 운영 흐름에 맞게 개선한다.
- 완료한 변경: 결석·패스·취소의 달력 기본 숨김과 기록 표시, 선택 날짜 패널과 월 메모 초안 보호, 학년 제안·진급과 두 번째 연락처, 시간 미정 학원레슨, 발주·입고·지급 흐름, 교재 수지·등록일·미납 해제일, 금액·시간 입력을 구현했다.
- 연결 요구사항: `docs/product/functional-spec.md`의 레슨표·원생·교재·수입 관리, `docs/product/acceptance-scenarios.md`의 같은 항목, `docs/product/book-management-spec.md`의 발주·입고 추가.
- 범위: 로컬 migration 7개를 작성하고 2026-10-20 사용자 요청에 따라 원격 DB에 적용했다. 앱 배포와 push는 하지 않았다.

## 먼저 작성한 테스트

- `src/domain/student-grade.test.ts`, `student-registration.test.ts`, `student-enrollment-edit.test.ts`: 학년 변환·수동 수정 보존·시간 미정 일정의 등록 허용. 첫 실행에서 기존 필수 시간 검증 때문에 실패했다.
- `src/features/lessons/lesson-month-calendar.test.tsx`, `lesson-monthly-note.test.tsx`, `workspace-helpers.test.tsx`: 결석·패스·취소 기본 숨김, 기록 표시, 초안·충돌 유지. 패스가 결석으로 남고 취소가 예정으로 바뀌던 테스트 실패를 확인했다.
- `src/features/academy-lessons/academy-lesson-attendance-screen.test.tsx`, `src/lib/api/academy-lessons.test.ts`: 시간 미정 수업의 임시 시각 노출과 누락된 조회 컬럼으로 실패한 뒤 수정했다.
- `src/domain/book-order.test.ts`, `book-finance.test.ts`, `src/lib/api/book-orders.test.ts`, `book-orders-schema.test.ts`: 발주 상태·금액·원장 연결과 nullable 참조 불일치. `IS DISTINCT FROM` 변경 전 계약 테스트 실패를 확인했다.
- `src/lib/api/book-orders-schema.test.ts`: 최초 입고 교재 보관·기존 입고일 복원·나중 입고부터 역순 취소 계약이 없는 상태에서 실패한 뒤 SQL을 보완했다. 이는 문자열 계약이며 실제 DB 실행 검증을 대체하지 않는다.
- `src/lib/supabase/book-payment-policy-contract.test.ts`, `src/features/books/book-shipment-screen.test.tsx`, `book-paid-screen.test.tsx`: 나중 결제 RPC 권한·버튼·잘못된 취소 후 안내를 먼저 실패시킨 뒤 수정했다.
- `src/features/books/book-stock-form-state.test.tsx`, `book-shipment-form.test.tsx`, `src/features/teachers/teacher-profile-money.test.tsx`, `src/features/students/student-lesson-fee-fields.test.tsx`, `src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx`: 쉼표 금액을 보존하지 못하거나 파싱하지 못하는 초기 실패를 확인한 뒤 공통 파서를 적용했다. 회차권 선택형 결제 금액은 0원과 빈 값을 유지하고 DB 정수 범위를 넘는 값은 막는다.
- `tests/e2e/home.spec.ts`: 320px 달력 도구와 1024px 패널 배치. 수정 전 ‘오늘로 이동’ 버튼이 달력 카드 오른쪽으로 약 75px 벗어나 실패했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| 관련 Vitest | 통과 | 달력·별도 출석표·발주 계약 등 변경 직후 재실행 |
| `pnpm test:run --reporter=dot` | 159개 파일·1,876개 테스트 통과 | 원격 migration 적용 후 전체 재실행. |
| `pnpm test:run src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx` | 28개 통과 | 미사용 테스트 변수 정리 후 영향 범위 재실행. |
| `pnpm typecheck` | 통과 | 최신 타입 확인 |
| `pnpm lint` | 통과 | 미사용 테스트 변수 1개 정리 후 재실행 |
| `pnpm test:e2e` | 20개 통과 | 최종 데모 production build 포함. 320px 교재 금액·결제 정책 E2E 추가. Node 20의 Supabase JS 지원 종료 예고 경고가 출력됐다. |
| `git diff --check` | 통과 | Markdown trailing whitespace 수정 후 재확인 |

## 브라우저 증거

- 데모 E2E `/lessons/academy`: 320·480·767·768·1023·1024·1280px에서 달력·선택 날짜 패널의 위치와 가로 넘침을 검사했다. 320px의 ‘오늘로 이동’ 버튼은 카드 안 다음 줄로 내려가고, 1024px에서는 패널이 달력 아래로 내려간다.
- `/books` 320px: 헤더 작업 메뉴에서 교재 등록 다이얼로그를 열고 `140,000` 입력을 보존하는지 확인했다. `/books/shipments`에는 나중 결제 버튼이 보이지 않는다.
- 스크린샷: `test-results/home-학원레슨-달력과-선택-날짜-패널은-각-화면-폭에서-겹치거나-가로로-넘치지-않는다-chromium/academy-calendar-{320,768,1024}.png`. 320px와 1024px를 직접 열어 시각적으로 확인했다.
- `mcp__cua_repl` 브라우저 표면은 이번 세션에서 사용할 수 없어 Playwright 스크린샷과 요소 경계 검증으로 대신했다. 운영 데이터 화면을 직접 클릭하는 검증은 하지 않았다.

## Supabase 증거

- 로컬 migration: `20261020090200_student_grade_anchor.sql`, `20261020090300_student_secondary_contact.sql`, `20261020090350_book_order_ledger_source.sql`, `20261020090400_book_orders.sql`, `20261020090500_lesson_audit_history.sql`, `20261020090600_time_unspecified_academy_lessons.sql`, `20261020090700_book_payment_at_registration_only.sql`.
- RLS·권한: SQL 계약 테스트와 독립 읽기 전용 리뷰에서 확인했다. 발주 지급은 원장, 발주·입고는 원장·데스크로 제한하고, 감사 이력은 원장·데스크만 조회하도록 작성했다.
- 적용: `pnpm supabase db push --dry-run`에서 위 7개만 대기 중임을 확인하고 `pnpm supabase db push --yes`로 모두 적용했다. 원격 migration history의 version은 로컬 파일명 `20261020090200`~`20261020090700`과 일치한다. 첫 파일의 기존 트리거 없음 NOTICE 외 오류는 없었다.
- 원격 카탈로그 검증: `students.grade_as_of_year`와 트리거, `book_orders`·`book_order_items`의 RLS·읽기 정책·직접 쓰기 차단, 발주 RPC의 authenticated 허용/anon 차단, 내부 helper의 실행 차단, 발주 원장 source, 입고 배치 참조·취소 시각, 레슨 감사 트리거와 조회 RPC, 나중 교재 결제 RPC 실행 권한 회수를 확인했다. 학년이 있는 원생의 기준연도 누락은 0건이고 새 발주·품목은 각 0건이다.
- Advisor: 새 발주 RPC의 `SECURITY DEFINER` 호출 가능 경고는 내부 학원 역할 검사와 권한 제한을 전제로 한 의도된 구조다. 성능 advisor는 새 발주 FK 일부의 인덱스 부재를 알린다. 현재 발주 행이 0건이므로 사용량을 보고 인덱스를 보강한다. 기존 Auth의 유출 비밀번호 보호 경고 등 프로젝트 전체 경고는 이번 migration에서 변경하지 않았다. [Supabase database linter](https://supabase.com/docs/guides/database/database-linter)
- **남은 실행 검증**: 별도 테스트 DB가 없어 데스크·원장·선생님 실제 JWT로 RPC 호출, 동시 요청·트랜잭션 롤백, 발주 취소 역순·재고 복원은 검증하지 못했다. 운영 데이터에 시험 발주를 만들지 않았다.

## 품질 정리

- 가독성: 캘린더 상태 라벨을 한 곳에 모으고 `goToToday`를 공통화했다. 날짜·금액·학년 규칙은 명명된 도메인 함수로 뒀다.
- 예측 가능성: 취소 상태를 예정으로 바꾸지 않고, 시간 미정 수업의 저장용 임시 시각을 모든 조회 화면에서 숨겼다. 원장 nullable 참조는 `IS DISTINCT FROM`으로 비교하고, 불일치면 취소를 막는다. 결제 취소 후의 다음 행동도 실제 가능한 삭제·재등록으로 안내한다.
- 응집도: 교재 발주 계산은 domain, DB 행 변환은 API adapter, 권한·원자성은 RPC, 화면은 feature 컴포넌트가 맡는다. 월 메모 초안은 월·레슨 종류별로 유지한다.
- 결합도: 캘린더와 오른쪽 패널은 같은 이벤트 데이터를 받되 독립 컴포넌트로 유지한다. 기존 레슨 workspace에 DB 로직을 넣지 않았다. 교재·회차권·선생님 금액 입력은 화면별 저장 정책을 유지하며 파싱만 공통 도메인 함수에 의존한다.
- simplify 결과: 달력의 도달 불가능한 모바일 칩 마크업과 화면 사용법 설명 문장, 더 이상 쓰지 않는 메모지 드래그·크기 조절 함수·나중 결제 UI/API를 제거했다. 월 도구 줄바꿈과 패널 배치를 콘텐츠 폭에 맞췄다. 중복 상태 라벨과 ‘오늘로 이동’ 핸들러를 줄였다. 교재·선생님·원생 금액은 공통 `parseWonInput`을 재사용한다.
- 독립 리뷰: Critical은 없었고 Warning 3건을 받았다. nullable 원장 비교와 별도 출석표 표시는 수정했다. 발주 취소 후 재고 입고일·신규 교재 처리와 변형된 원장 지급 취소는 사용자 답변을 받아 정책과 계약 테스트를 반영했다.

## 위험과 확인 질문

- 새 DB 함수의 정의와 권한은 원격에서 확인했으나 업무 데이터로 RPC를 실행하지 않았다. 앱 배포 전에 실제 계정으로 발주·입고·지급·취소, 시간 미정 출석, 두 번째 연락처를 QA한다.
- 사용자 결정: 교재 결제 완료는 출고 등록 때만 가능하다. 결제 취소 뒤 재확정은 출고 삭제·재등록으로 한다. 같은 교재의 입고 취소는 역순이며 최초 교재는 보관·기존 교재는 직전 입고일 복원이다. 변형된 원장 행이 있으면 지급 취소·발주 취소를 막고 정정을 안내한다.
- 교재 발주·입고 화면에서 운영 DB의 실제 데이터로 등록·입고·지급·취소·재고 복원을 확인해야 한다.

## Git

- 구현·migration 커밋: `aa92586` (`feat(operations): 레슨·원생·교재 운영 흐름 개선`).
- 문서·evidence: 별도 `docs` 커밋으로 기록한다.
- push: 하지 않음.
