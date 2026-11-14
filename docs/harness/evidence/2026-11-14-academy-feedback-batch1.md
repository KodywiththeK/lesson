# 2026-11-14 학원 피드백 1차 (레슨시간표·교재·수입 관리)

## 요약

- 목표: 학원 피드백(레슨시간표·교재·수입 관리) 중 스키마 영향이 작은 항목과 교재 일괄 출고를 먼저 반영한다. 해석이 갈린 항목은 모두 사용자에게 질문해 확정했다(계획: `/Users/wyd/.claude/plans/0-1-wondrous-frog.md`).
- 완료한 변경
  - A1 교재 도서 선택지를 숫자 크기 순으로 정렬(`compareKoreanNames`).
  - A2 개인레슨 일정 순서가 시간대 표기(`+09:00`/`+00:00`)가 섞이면 뒤바뀌던 문자열 비교를 실제 시각 비교로 통일(`comparePrivateLessonStartAt`).
  - A3 선생님 월 스케줄표 문자 양식(`formatTeacherMonthScheduleMessage`, 고정 양식, 취소 일정 제외).
  - A4 월별·일별 메모의 `- [ ]` 체크 줄(체크박스 렌더, 추가 버튼). DB 변경 없음.
  - A5 달력 일정 칩 상태색 통일(예정 회색·등원/출석 초록·결석 빨강), 악기 색은 왼쪽 띠로 유지, 결석 기본 표시.
  - A6 학원 고정 수입 `납입일` 열·납입일순 기본 정렬·`납입일 경과` 표시(화면 계산).
  - B1 교재 일괄 출고(원생 1명 + 도서 여러 줄, 한 트랜잭션 RPC `register_book_releases`, migration 작성만).
  - B4 최초 등록일 수정 시 입금 전 수강료 납입일 갱신 trigger(migration 작성만).
  - B3 등하원 현황: 일별 테이블뷰에 `등하원 현황` 구획(학원·개인레슨 학생 합침, 등원/하원 시각, 출결과 별개). 원장·데스크 기록, 오늘 날짜만, 선생님은 담당 원생 읽기 전용, 학부모 제외. 테이블 `student_presence` + RPC 2개(migration 작성만).
- 커버한 요구사항: BK-05(출고 등록 확장), 명세 `functional-spec.md`(메모·레슨 색·선생님 시간표·고정 수입), `book-management-spec.md` 4.1·8·9장, `decision-log.md` 2026-11-14 항목 3건.
  - 일정 수정을 등록 화면 구성으로: 단계 표시, 날짜·악기(고정)·원생(고정)·선생님(악기 담당)·시작 시간·레슨 시간(분, 수정 가능)·종료 시간(자동), 같은 선생님 시간 겹침 안내·저장 막기. 서버 RPC는 이미 종료 시각을 받아 DB 변경 없음. 테스트: `private-lesson-edit-dialog.test.tsx`(Red 5건 확인 후 Green).
  - B2 1단계(회차권 입금 상태): 상태 5개(등록·입금대기·입금완료·환불·취소)·납입일·결제 방식 컬럼, 등록=사용 불가/입금대기부터 사용 가능(가용량 함수 한 곳), 10인자 등록 RPC(유료는 '등록' 시작·수입 없음, 서비스는 바로 입금완료), 입금대기 시작·입금 처리(입금일·결제 방식, 수입 행)·입금 취소 RPC. 옛 8·9인자 등록은 이전 동작 유지. 화면: 등록 폼 납입일, 회차권 목록 '입금 상태' 열, 수입 관리 회차권 행의 상태·납입일 경과·버튼과 납입일 정렬 합류, 데모 전환. migration `20261114000300_lesson_ticket_payment_status.sql`.
  - B2 2단계: 환불·취소를 삭제 대신 상태로 보존(잔여 0, 등록·사용 이력 유지, 목록·학원 레슨수입에서 제외하고 사용취소 탭으로), 입금완료 환불은 수입 감액·입금대기 환불은 계산 금액만 이력, 등록 상태는 취소만, '잘못 등록 삭제' → '취소(잘못 등록)', 예약이 남으면 거부. 외상 예정 등록·미정산 화면·API(`private-lesson-credits.ts`) 제거, 새 외상 예정은 DB trigger로 거부, DB 예약 실패 문구의 외상 안내는 화면에서 새 안내로 바꿈. migration `20261114000400_lesson_ticket_refund_cancel_status.sql`.
- 로컬 개발 환경: `supabase/config.toml`을 CLI v3 형식으로, `seed.sql`을 현재 스키마에 맞게 고치고, 운영 적용된 `20261028073720`에 트랜잭션 경계만 더해(사용자 승인) 저장소 그대로 `supabase start` 한 번에 migration·seed가 모두 적용된다. 방법은 runbook '로컬 DB로 migration 실행 검증'.
- 외상 표·칸·함수의 물리적 삭제는 후속 결정에서 정리 migration `20261114000600`으로 처리했다(아래 "후속 결정 반영").

## 먼저 작성한 테스트

- 테스트 파일: `book-shipment-form.test.tsx`, `book-stock.test.ts`, `private-lesson.test.ts`, `monthly-lesson-absence.test.ts`, `private-lesson-edit-dialog.test.tsx`, `teacher-schedule-message.test.ts`, `memo-checklist.test.ts(x)`, `lesson-monthly-note.test.tsx`, `lesson-day-memo-dialog.test.tsx`, `lesson-month-calendar.test.tsx`, `private-day-attendance-dialog.test.tsx`, `tuition-income.test.ts`, `finance-lesson-income-screen.test.tsx`, `books.test.ts`, `academy-demo-books.test.ts`, `book-bulk-release-contract.test.ts`, `tuition-due-on-sync-contract.test.ts`, `student-presence.test.ts`(도메인·API), `student-presence-panel.test.tsx`, `lesson-student-presence.test.tsx`, `lesson-management-workspace.test.tsx`(등하원), `student-presence-contract.test.ts`.
- 시나리오: 자연 정렬 순서, 혼합 오프셋 정렬, 문자 양식 전체 문자열, 체크 줄 파싱·토글·저장 경로(월별 초안/일별 즉시 저장), 상태색 `data-tone`과 악기 띠, 결석 기본 표시, 납입일 열·정렬·경과, 일괄 출고(줄 추가/삭제, 중복 도서 제외, 줄 번호 안내, 묶음 결제, 전체 롤백), RPC·trigger 계약.
- 초기 실패(Red)를 확인한 항목: A1(정렬 미적용), A2(함수 없음), A3(모듈 없음), A4(체크박스·버튼 없음), A6(납입일 열·경과·정렬 없음), B1 폼·도메인·데모(기능 없음), B1 RPC 계약(migration 파일 없음). A5는 기존 단언(악기색 배경·결석 숨김)을 새 규칙으로 먼저 바꾼 뒤 구현했다. B1 API(`registerBookReleases`)와 B4 계약 테스트는 테스트와 구현을 같은 단계에서 작성해 별도 Red 실행을 하지 않았다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm typecheck` (simplify 후 재실행) | 통과 | |
| `pnpm lint` (simplify 후 재실행) | 통과 | |
| `pnpm test:run` (simplify 후 재실행) | 2419 통과 / 10 실패 | 실패 10건은 아래와 같은 기존 환경 문제 |
| `pnpm test:run` (1차) | 2321 통과 / 10 실패 | 실패 10건은 모두 `academy-session-gate.test.tsx`(`Cannot read properties of undefined (reading 'clear')`, Node v26 `localStorage` 경고 환경 문제). 변경을 모두 치운 상태(`git stash`)에서도 같은 10건이 실패해 이번 변경과 무관함을 확인했다 |
| `NEXT_PUBLIC_E2E_DEMO=1 pnpm build` + `next start` | 통과 | 데모 화면 수동 확인 |
| `pnpm test:e2e` (simplify 후 재실행) | 41 통과 | `.env.local` 배치·Playwright 브라우저 설치 후 전부 통과 |
| `pnpm test:e2e` (1차) | 38 통과 / 3 실패 → 2건 수정 후 해당 스펙 9 통과 | Playwright Chromium 설치 후 실행. 실패 중 2건(`lesson-schedule-improvements` 색상)은 옛 규칙(달력 칩·출석 카드 악기색 배경)을 단언하던 테스트라 새 규칙(상태색 배경·악기색 왼쪽 띠)으로 고쳤다. 남은 1건 `academy-onboarding`(원장 가입 신청)은 이 컴퓨터에 `.env.local`(Supabase 주소)이 없어 화면이 Supabase 요청을 보내지 않는 환경 문제로 보이며, 해당 화면은 이번에 바꾸지 않았다(깨끗한 상태에서 재현 확인은 하지 않음) |

## 브라우저 증거

- URL: `/books/shipments`, `/lessons/private`(2026-08), `/finance/lesson-income`(데모, 데스크톱 1024px).
- 데스크톱 확인: 출고 폼에서 원생 선택 → 도서 1 선택 → `도서 추가` → 도서 2 선택 → `출고 등록`. 재고 9→8, 4→3, 출고 2건 생성, 폼 초기화. 개인레슨 달력의 예정 칩은 회색 배경 + 악기 색 왼쪽 띠. 고정 수입 표에 `납입일` 열과 `납입일 경과` 배지.
- 모바일 스크린샷: 찍지 않았다(좁은 폭의 도서 줄 배치와 납입일 모바일 카드는 컴포넌트 테스트의 `data-label` 단언으로만 확인). 증거 한계.
- 비고: 변경 이력처럼 서비스 연결이 필요한 화면과 실제 RPC는 데모에서 확인할 수 없다.

## Supabase 증거

- Migration(작성만, **적용하지 않음**): `20261114000000_register_book_releases.sql`, `20261114000100_student_registered_on_due_on_sync.sql`, `20261114000200_student_presence.sql`.
- RLS 확인: 새 테이블 `student_presence`는 RLS를 켜고 정책 없이 `anon, authenticated` 권한을 모두 회수해 RPC로만 접근한다(계약 테스트로 확인, 실제 DB 미확인). 새 RPC는 `revoke all ... from public, anon` 후 `authenticated`에만 실행 권한을 주고, 내부에서 `private.assert_book_role`로 원장·데스크 및 결제 완료는 원장만 허용한다.
- 역할별 확인: 계약 테스트(SQL 문자열 검사)만 수행했다. **실제 DB에서 SQL을 실행하지 않았다.** 적용 전 `docs/engineering/supabase-migration-runbook.md`의 dry-run과 권한(데스크의 `paid` 거부, 재고 부족 전체 롤백, 중복 도서 거부, 등록일 수정 시 입금 전 납입일만 갱신, 선생님의 담당 원생만 조회·기록 거부, 오늘이 아닌 날짜 거부)을 실제로 확인해야 한다.
- 비고: 단건 `register_book_release`는 그대로 두어 옛 앱과 호환된다(앱에서는 더 이상 호출하지 않는다).

## 품질 정리

- 코드 단순화: 일괄 출고로 쓰이지 않게 된 단건 등록 경로(API `registerBookRelease`와 RPC 타입, 데모 provider의 `registerBookRelease`, 폼의 `createEmptyShipmentValues`)와 달력의 악기색 배경 코드(`getPrivateEventColorStyle`, `textColor` 전달, `dimSecondary`)를 제거했다. `getInstrumentColorTone/Style`의 쓰이지 않던 `status` 인자를 없앴다. 데모 `registerDemoBookReleases`의 도달 불가능한 `missingBook` 분기를 지웠다.
- 재사용한 추상화: `compareKoreanNames`(자연 정렬), `toFinanceDate`·`comparePrivateLessonStartAt`(시각), 발주 다건 입력 패턴과 `apply_book_stock_delta`·`mark_book_release_paid`(일괄 출고 RPC), `student_discount_snapshot_sync` trigger 패턴(납입일 갱신), `buildListView`의 `getSortValue`(납입일 정렬).
- 테스트 정리: 옛 규칙을 못박던 단언(악기색 배경, 결석 기본 숨김, 단건 출고 RPC)을 새 규칙으로 교체하거나 지웠다. 클래스 문자열 대신 `data-tone`·role·접근 가능한 이름으로 단언한다.
- 가독성: 문자 양식·체크 줄·상태색·일괄 출고 검증을 이름 있는 순수 함수로 분리했다(`formatTeacherMonthScheduleMessage`, `toggleMemoChecklistLine`, `getCalendarEventTone`, `validateBookReleaseBatchInput`).
- 예측 가능성: 시각은 항상 epoch로 비교하고 한국 날짜는 `toFinanceDate`로 변환한다. 일괄 출고는 전체 성공 또는 전체 실패다. 납입일 경과는 DB 상태를 바꾸지 않는 화면 표시다.
- 응집도: 로직(`src/domain`)과 화면(`src/features`)을 분리했고 메모 체크 부품은 월별·일별이 함께 쓴다(`memo-checklist.tsx`).
- 결합도: 폼은 값 변환·검증을 `book-shipment-values.ts`에 위임하고 화면은 operations 주입으로 데모·실서비스를 바꾼다.
- simplify 결과: 재사용·품질·효율 3관점 에이전트를 병렬로 돌리고 지적 사항을 코드에서 직접 확인한 뒤 고쳤다.
  - 고친 것(동작): ① 등하원 조회 RPC의 날짜 조건을 서울 하루 범위 비교로 바꿔 인덱스를 쓸 수 있게 함 ② 환불·취소된 회차권 뒤 같은 원생·악기 재등록이 막히던 검사 수정, 선생님용 잔여 조회(`get_assigned_lesson_ticket_balances`)와 앱 잔여 합산(`lesson-workspace.ts`)에서 등록 상태 회차권 제외 ③ 환불·취소 RPC의 등록·사용 조회에 `academy_id` 조건 추가, 서비스가 섞인 옛 회차권의 상태 정규화 ④ 입금대기 회차권 환불 시 "N원을 환불했습니다"로 잘못 안내하던 문구를 `ledgerChanged`로 구분(수입 그대로 + 규정 환불 금액 안내) ⑤ 일별 메모를 수정하는 중에는 저장된 카드의 체크박스를 비활성화(초안과 즉시 저장이 엇갈리지 않게) ⑥ 등하원은 데모일 때만 화면 안 기록을 쓰고, 실서비스에서 저장소 연결에 실패하면 조용히 데모처럼 동작하지 않고 오류를 알림(실서비스에서는 명단 계산도 생략). 각 항목은 Red 테스트 또는 로컬 DB로 먼저 확인했다.
  - 고친 것(정리): 레슨 시간 검사(`MIN/MAX_LESSON_MINUTES`, `parseLessonMinutes`)를 `src/domain/private-lesson.ts`로 옮겨 등록 폼·수정 다이얼로그가 공유, 수정 다이얼로그의 시각 문자열을 `toSeoulIsoOffset`으로 통일, `selectBook`/`selectBookForItem`을 제네릭 `selectBook` 하나로 통합, 수입관리 `today`를 화면에서 한 번만 계산, 인라인 `import()` 타입을 `import type`으로, 등하원 이름 정렬을 `compareKoreanNames`로, 데모 변수명 `withoutTicket` → `closedTicketState`.
  - 남긴 것(사유): 데모 입금 전환은 상태별 거부 문구가 서버 RPC 문구와 1:1로 맞춰져 있어 `getLessonTicketPaymentActions`로 합치지 않았다. `"use client"` 위치 검사 결과 이상 없음.
- 코드 품질 리뷰: Critical 없음.
- 남긴 Warning/Suggestion: ① 일별 메모의 체크 토글은 `onUpdateMemo`가 `unread: false`로 저장하는 기존 동작을 따른다. ② 메모 체크 추가 버튼의 커서 이동은 `setTimeout(0)`에 의존한다. ③ 개인레슨 일별 표의 악기 태그는 예정·등원일 때만 악기 색을 쓰는 기존 조건을 유지했다(결석은 무색).
- 등하원 판단: 한 학생이 학원·개인레슨 일정이 모두 있어도 하루 1회만 기록한다. 출결이 결석이어도 예정된 일정이면 목록에 남는다(삭제·취소 일정만 제외). 등하원은 "지금 학원에 있는지" 표시라 오늘 날짜에만 기록하도록 제한했다(지난 날짜 기록이 필요하면 후속 결정).
- 남은 부채: 개인레슨 일정 순서 뒤바뀜의 원인은 정렬로 확정했지만 실제 운영 화면 재현은 하지 못했다(저장 직후/새로고침 후 어느 쪽에서 보였는지 확인 필요).

## 로컬 Supabase 실행 검증 (2026-11-14 추가)

- 환경: Docker 29.9.3 + Supabase CLI 3.1.0, Postgres 17(`public.ecr.aws/supabase/postgres:17.11.0.018`). 저장소 `supabase/config.toml`이 CLI 버전과 맞지 않아 scratchpad의 최소 설정(DB·Auth만)과 migration 사본으로 실행했다. 사본에서는 CLI가 트랜잭션을 씌우지 않아 실패하는 기존 `20261028073720`(`LOCK TABLE`)만 `begin; … commit;`으로 감쌌다(저장소 파일은 그대로).
- 결과: 기존 migration 전체 + 새 migration 4개가 모두 적용됐다(문법·정의 오류 없음).
- 시나리오(원장·데스크·선생님 계정, `request.jwt.claims`로 역할 전환):
  - 교재 일괄 출고: 원장 결제완료 2건·재고 감소·원장 행 2개 / 2번째 줄 재고 부족 시 "2번째 도서: 재고가 부족합니다. 남은 재고는 1권입니다."와 전체 롤백 / 중복 도서 거부 / 데스크의 결제완료 거부 / 데스크 결제대기 성공.
  - 회차권 입금 상태: 데스크 10인자 등록 → 등록·수입 0·납입일 저장·예약 가능 0 / 등록 상태 예약 거부 / 등록 상태 입금 처리 거부 / 입금대기 후 예약 가능 4·예약 시 회차 배정 / 잘못된 결제 방식 거부 / 입금 처리 → 입금완료·수입 행(입금일)·등록 이력 연결 / 입금 취소 → 입금대기·수입 행 삭제·연결 해제 / 서비스 → 바로 입금완료, 입금 취소 거부 / 옛 9인자 → 바로 입금완료+수입 / 선생님 전환 거부.
  - 등하원: 데스크 조회·등원·하원 / 하원 후 등원 취소 거부 / 등원 전 하원 거부 / 오늘 아닌 날짜 거부 / 선생님은 담당 배정(`student_teacher_assignments`)된 원생만 조회, 기록 거부, 표 직접 읽기 `permission denied`.
  - 납입일 갱신: 등록일 2026-10-04 → 2026-10-20 수정 시 이번 달 미입금 스냅샷 납입일 2026-11-04 → 2026-11-20, 감사 행 1건.
- 2단계 시나리오(저장소 seed 위에서, 환불 규정 '언제든 비례'): 등록 상태 환불 거부·취소 → 취소·잔여 0·수입 없음·사용취소 이력 / 입금완료 미사용 환불 → 환불·수입 행 삭제(200,000원) / 입금대기 환불 → 환불·이력 120,000원·수입 변화 없음 / 입금완료 미사용 취소 → 취소·수입 행 삭제 / 이미 환불된 회차권 재처리 거부 / 사용한 회차권 취소 거부 / 예약이 남은 회차권 환불 거부 / 외상 예정 일정 저장 거부 / 환불·취소된 회차권은 예약 가능 회차에서 제외.
- 한계: 학원·개인레슨 학생을 합치는 등하원 목록은 개인레슨 준비 데이터가 "재직 선생님 필요" 규칙에 걸려 DB에서는 학원레슨 학생만 확인했다(합치는 로직은 단위 테스트로 확인). 운영 DB에는 적용하지 않았다.

## 후속 결정 반영 (2026-11-14, 3건)

사용자 결정: ① 입금 전 회차권 이월 표시 ② 급여 개인레슨 단가에서 취소 회차권 제외, 환불 전에 수업한 회차는 원래 단가로 지급(입금 전도 포함) ③ 외상 표·칸·함수 지금 정리. ②는 처음에 환불·취소를 모두 뺐다가, 환불 전 수업분까지 빠져 지급 확정이 막히는 문제를 확인받고 취소만 빼는 것으로 바꿨다.

- 변경
  - 이월: `buildPrivateLessonIncomeRows`에 `currentMonth` 인자를 더해 입금 전 회차권을 납입일 달부터 이번 달까지 매달 보여 준다. 입금완료는 입금한 달에만 보인다.
  - 급여 단가: 화면 `toPrivateLessonFeeSources`가 취소 회차권을 빼고, 지급 확정 검증 SQL은 migration `20261114000500_payroll_exclude_cancelled_tickets.sql`로 `grant_row.payment_status <> 'cancelled'` 한 줄을 더해 다시 정의했다. 환불 회차권은 원래 단가(결제 금액 ÷ 부여 회수)로 남는다.
  - 외상 삭제: migration `20261114000600_drop_private_lesson_credit.sql`. 외상 데이터(외상 일정·기록)가 있으면 멈추는 안전장치 → 외상 trigger 2개·함수 4개 삭제 → 외상을 참조하던 함수 10개를 외상 분기 없이 다시 정의 → `private_lesson_credits` 표와 `lesson_events.credit_authorized` 칸 삭제. 함수 본문은 로컬 DB의 현재 정의(`pg_get_functiondef`)에서 외상 분기만 기계적으로 걷어 냈고, 남은 외상 참조가 있으면 생성이 실패하게 했다. 옛 9인자 `register_lesson_ticket` 반환값에서 `settled_credit_count`를 뺐다(앱은 이 값을 읽지 않는다).
- 테스트: 이월 2건(`lesson-ticket-income.test.ts`), 급여 단가 1건(`finance-payroll-screen.test.tsx`)은 Red(실패)를 먼저 확인했다. 계약 테스트 `payroll-cancelled-ticket-contract.test.ts`, `private-lesson-credit-drop-contract.test.ts`는 migration을 먼저 쓰고 나서 작성해 별도 Red 실행은 없다.
- 로컬 DB(`db reset --local`, 새 migration 포함 전체 적용 + seed 성공) 시나리오, 원장 계정: 외상 칸·표 없음 확인 / 등록 상태 회차권으로 예약 거부(새 안내 문구) / 입금대기 후 예약·1회차 배정 / 등원 → 잔여 3 / 급여 단가(비율 50%) 25,000원 / 출석 취소 → 잔여 4 / 결석(사유 저장, 잔여 4) / 다시 등원 → 잔여 3 / 입금대기 환불(150,000원, 원장 변화 없음) / 환불 후에도 환불 전 수업분 급여 단가 25,000원 유지(결정 변경 후 `db reset`으로 다시 확인).
- 검증: `pnpm lint` 통과, `pnpm typecheck` 통과, `pnpm test:run` 2427 통과 / 10 실패(기존 `academy-session-gate` 환경 문제), `pnpm test:e2e` 41 통과.
- 가독성: 이월 조건을 `isDueMonth`·`isCarriedOver` 이름으로 드러냈다. 예측 가능성: 이월은 `currentMonth`를 인자로 받아 같은 입력에 같은 결과를 낸다. 응집도: 급여 단가 규칙은 화면 함수와 SQL 한 곳씩, 같은 조건이다. 결합도: 외상 삭제는 앱 코드 변경 없이 DB만 바꾼다(앱은 이미 외상을 쓰지 않음).
- simplify 결과: 변경 범위가 작아(함수 2개 조건 추가 + 기계적 SQL 정리) 직접 다시 읽어 확인했다. 외상 삭제 migration의 예약 검사 함수는 `else` 분기를 없앤 뒤 들여쓰기를 정리했다.
- 위험: ① `20261114000600`은 지금 배포된 앱(HEAD)이 `credit_authorized`를 읽으므로 새 앱 배포 뒤 적용해야 한다(runbook에 순서 기록). ② (해소) 환불 회차권의 환불 전 수업분은 원래 단가로 지급하기로 해 지급 확정이 막히지 않는다. ③ 운영 DB의 외상 데이터 건수는 확인하지 못했다(운영 접근 수단 없음). 남아 있으면 migration이 멈춘다.

## 커밋 전 종합 검토 (2026-11-14)

- 방법: 요구사항 누락·부작용·UX/반응형 3관점을 읽기 전용 에이전트로 병렬 검토하고, 데모 빌드를 브라우저(1366px·360px)로 직접 확인했다. 발견 사항은 코드에서 확인한 뒤 고쳤다. 정책이 걸린 3건은 사용자에게 물었다(데스크는 회차권 목록에서만 입금 처리, 월별 메모 체크 바로 저장, 합쳐진 이전 회차권 입금 취소 막기).
- 고친 것(동작): 로그인 화면 테스트 10건 실패 원인(Node 25+ 전역 `localStorage`가 jsdom 저장소를 가림)을 테스트 setup에서 해소 / 수입관리에서 회차권 입금 상태를 바꾸면 회차권·레슨표·예약 가능 회차 캐시도 갱신(`invalidateAfterLessonTicketChange`) / 합쳐진 이전 회차권(`legacy_merged`) 입금 취소 서버 거부·버튼 숨김 / 데모: 등록 상태 회차권을 예약 가능 회차에서 제외, 수입관리 입금 버튼 연결, 예약이 남은 회차권 환불·취소 거부 / 사용취소 이력의 "삭제" 표기를 "취소"로 / 레슨표가 다시 불리면 등하원 명단도 갱신 / 월별 메모 체크 즉시 저장(저장 중 잠금) / 일별 메모 체크를 화면에 먼저 반영하고 실패 시 되돌림(연속 클릭 덮어쓰기 방지).
- 고친 것(UI): 일정 수정 다이얼로그 높이 제한·스크롤과 단계 표시 압축 / 레슨 시간 범위 밖 안내 문구(`aria-describedby`) / 휴원일 경고를 토큰 색과 공용 `Checkbox`로 / 회차권 납입일·서비스 체크박스를 공용 `Checkbox`로 / 버튼 이름 "입금대기로 전환", 확인 버튼 "환불 처리"·"취소 처리", 환불·취소 아이콘 `Undo2` / "납입일 경과" 배지 색 통일(`warning`) / 회차권 탭 점·달력 휴원 글자 색 토큰화 / 빈 체크 줄 이름 / 도서 줄 추가·삭제 포커스 이동과 정렬 / 1366px에서 회차권 표가 가로 스크롤 없이 들어가도록 보조 줄 줄바꿈 허용.
- 반영하지 않은 제안(사유): 도서 줄 입력 이름에 줄 번호 넣기(`fieldset`의 `legend` "도서 N"이 이미 묶음 이름을 준다) / 등하원 `li`의 `aria-label` 제거(목록 항목은 내용으로 이름을 정하지 않고 내용도 그대로 읽힌다) / 회차권 목록 입금 다이얼로그 금액(데스크가 읽을 수 없는 결제 금액이라 목록 데이터에 없음) / `database.types.ts` 재생성(이 저장소는 원격 적용 후 재생성하는 관례) / 퇴원 원생 등하원 기록 차단·입금일 서버 범위 검사(명단 밖이라 화면에서 생기지 않음, 우선순위 낮음) / 수정 다이얼로그의 다른 달 겹침 확인(서버 guard가 최종 차단).
- 테스트: 이번 라운드의 Red 먼저 확인 — 합쳐진 회차권 입금 동작, 공용 무효화, 데모 예약 남은 회차권 거부, 월별 체크 즉시 저장·잠금, 도서 줄 포커스(구현 전 실패 확인은 앞의 4건). 이력 "취소" 표기·레슨 시간 안내·빈 체크 줄 이름은 구현과 함께 작성했다. 등하원 명단 갱신과 일별 메모 낙관적 반영은 별도 테스트 없이 전체 테스트·e2e로 회귀만 확인했다.
- 검증: `pnpm lint` 통과, `pnpm typecheck` 통과, `pnpm test:run` 2446 통과(실패 0), `pnpm test:e2e` 41 통과. 로컬 DB에서 migration 7건 전체 적용, 합쳐진 회차권 입금 취소 거부("여러 구매가 합쳐진 이전 회차권은 입금을 취소할 수 없습니다.") 확인.
- simplify 결과: 앞선 3관점 simplify 에이전트 결과와 이번 3관점 검토를 재사용하고, 이번에 바꾼 코드는 직접 다시 읽었다. 회차권 무효화 묶음을 공용 함수로 옮겨 두 화면이 같이 쓰게 했고, 교재 값 파일의 어긋난 JSDoc을 정리했다. 추가로 고칠 중복은 찾지 못했다.

## 위험과 확인 질문

- 해소된 질문: 입금 전 회차권 이월(이월 표시), 급여 단가(취소만 제외, 환불 전 수업분은 원래 단가), 외상 물리 삭제(`000600`), 일정 수정 "회차권 등록처럼"(등록 화면 구성, 원생·악기 고정), 데스크 입금 처리 범위(회차권 목록만), 월별 메모 체크(바로 저장), 합쳐진 이전 회차권 입금 취소(막음).
- 위험: 새 migration 7건(`20261114000000`~`000600`)은 로컬 DB에서 실행·시나리오 검증했지만 운영 DB에는 적용하지 않았다. 적용 순서(`000500`까지 → 새 앱 배포 → `000600`)와 중간 구간 영향은 runbook에 적었다. 운영의 외상 데이터 건수는 확인하지 못했다(남아 있으면 `000600`이 멈춘다).
- 남은 작은 차이: 데모의 환불·취소는 서비스 회차가 섞인 회차권도 통째로 환불·취소 상태로 바꾼다(서버는 유료분만 정리하고 서비스분은 남김). 데모 전용 차이라 실서비스에는 영향이 없다.

## Git

- 커밋: 없음(사용자 요청 시에만).
- push 여부: 없음.
