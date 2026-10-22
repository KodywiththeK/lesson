# 권한 설계

권한 동작은 UI 표시와 Supabase RLS 양쪽에서 테스트한다.

## 역할

- `owner`: 학원 전체 접근
- `desk`: 일상 운영 담당, 재무 접근은 확인 필요
- `teacher`: 배정 수업 확인, 허용된 출석 액션, 본인 급여 확인

## 제안 접근 매트릭스

| 영역 | 원장 | 데스크 | 선생님 |
| --- | --- | --- | --- |
| 학원 피아노 레슨표 | 전체 관리 | 전체 관리 | 조회만(쓰기 버튼 숨김), 조회 범위는 배정 원생 기준 |
| 개인레슨표 | 전체 관리 | 전체 관리 | 본인 수업 조회·출석 확인, 등록 버튼 숨김 |
| 회차권 | 발급/수정/삭제(환불 처리·잘못 등록)/결제 입력 | 발급/수정/삭제와 등록 시 결제 금액 입력(수정은 사유 필수, 이력 기록). 입출입내역 화면은 접근 불가 | 담당 원생의 담당 악기 잔여 회수·만료일만 개인레슨표에서 조회 |
| 원생 | 전체 관리 | 전체 관리 | 담당 원생의 이름·악기·요일만 읽기 전용(서버 RPC `list_students_for_teacher`, 수강료·할인·연락처 제외) |
| 선생님 | 전체 관리(급여 설정·주민등록번호 원문 포함) | 기본 정보만 등록·수정(급여 설정과 주민등록번호 원문 불가) | 접근 불가 |
| 상담 | 전체 관리 | 전체 관리 | 접근 불가 |
| 거래처 | 전체 관리 | 전체 관리 | 접근 불가 |
| 교재 | 전체 관리(결제 처리·취소 포함) | 교재·재고·출고(결제 전) 관리, 결제 완료 목록 조회 | 접근 불가 |
| 수입 관리 | 전체 관리 | 접근 불가(허용 여부는 후속 질문) | 접근 불가(본인 급여 화면은 후속 질문) |

## RLS 규칙

- 원장 policy는 `academy_members`의 owner 역할과 `academy_id`를 기준으로 한다.
- 데스크 policy는 학원 멤버십, desk 역할, 허용 테이블을 기준으로 한다.
- 선생님 policy는 배정된 수업/원생과 본인 급여 row를 기준으로 한다.
- anonymous 사용자는 앱 데이터에 접근할 수 없다.
- UPDATE policy는 `USING`과 `WITH CHECK`를 모두 가져야 한다.
- API에 노출되는 view는 지원되는 경우 security-invoker 동작을 사용한다.

## 화면 접근 안내 (UX, 보안 경계 아님)

- 현재 역할에게 숨겨진 메뉴 주소로 직접 들어오면 `AppShell`이 내용을 마운트하지 않고 "이 화면을 볼 권한이 없습니다" 안내와 홈 링크를 보여준다(`src/app/app-shell.tsx`의 `isForbiddenRoute`). 원문 RLS 오류를 노출하지 않기 위한 화면 편의다.
- 이 안내는 권한 검증이 아니다. 민감 데이터 보호는 계속 Supabase RLS와 서버 경계가 책임지고, 메뉴 숨김·안내 화면에 의존하지 않는다.
- teacher의 "내 급여" 링크는 화면(`/my/payroll`)과 teacher용 select 정책이 생길 때까지 숨긴다. `allowDeskFinance` 플래그는 제거했다(수입 관리는 원장 전용이라 데스크는 어떤 설정으로도 열 수 없다). 회차권 수동 수정은 원장·데스크 모두 허용하며 별도 desk 플래그를 쓰지 않는다.
- `lesson_ticket_grants`·`lesson_ticket_usages`·`lesson_ticket_adjustments`에 브라우저 직접 쓰기를 허용하지 않는다. 등록·수정·출석 RPC가 학원 역할과 범위를 검사하고, 선생님 전용 조회 RPC는 담당 악기의 잔여·만료일만 반환한다. 2026-10-16 운영 DB에서 직접 쓰기 권한 회수와 등록 이력 owner 조회 정책을 확인했다.

## 레슨 시간표 화면의 선생님 UI 규칙 (UX, 보안 경계 아님)

- `LessonManagementWorkspace`는 `canManage`(원장·데스크만 true)가 false이면 학원 레슨표의 출석확인·결석확인·이동·삭제·보강·초기화·일정 추가 버튼과 월별 포스트잇을 숨기고 조회 전용 안내를 보인다. 개인레슨 등록 버튼도 숨기지만 배정 원생의 출석 확인은 유지한다.
- 버튼 숨김은 편의일 뿐이다. 실제 허용은 아래 RPC의 `has_academy_role` 검사와 RLS가 책임진다.

| RPC | 허용 역할 | 비고 |
| --- | --- | --- |
| `resolve_academy_lesson_absence` | owner, desk | 이미 처리된 결석은 거부(멱등), 회차권 미접촉 |
| `delete_academy_lesson_event` | owner, desk | 사유 필수, 출결 처리된 일정 거부 |
| `move_academy_lesson_event` | owner, desk | 같은 달 안에서만 이동 |
| `cancel_private_lesson_attendance` | owner, desk, 배정 선생님 | 차감 복구 후 출결 삭제 |
| `register_lesson_ticket` | owner, desk | 결제 금액은 owner·desk 모두 입력 가능(2026-10-22). 수입 행은 트랜잭션 로컬 설정으로 원장 트리거를 통과한다 |
| `get_lesson_ticket_refund_preview` | owner, desk | 학원 환불 규정으로 계산한 환불 가능 여부·환불 예정 금액·잘못 등록 가능 여부. 데스크가 읽을 수 없는 결제 금액은 서버만 계산 |
| `delete_lesson_ticket` | owner, desk | `refund`(규정 검사 후 수입 행을 최근 결제부터 감액, 불가면 수입 유지)·`mistake`(사용 이력 없을 때만 수입 기록까지 삭제). 감사 기록 `lesson_ticket.deleted` |
| `set_lesson_ticket_refund_policy` | owner | 환불 규정 변경. 설정 화면은 원장에게만 보이고 `academy_settings` 읽기도 원장 전용 |
| `adjust_lesson_ticket` | owner, desk | 사유 필수, 조정 이력과 audit 기록 |

### 원장 쓰기 트리거의 회차권 예외(2026-10-22)

`ledger_entries`는 RLS와 `private.require_finance_owner_for_ledger` 트리거가 원장 외 쓰기를 막는다. 데스크가 회차권 등록 때 결제 금액을 입력하고 회차권을 삭제(환불·잘못 등록)할 수 있도록 트리거는 아래 세 조건이 **모두** 맞을 때만 통과시킨다.

1. 같은 트랜잭션에서 회차권 RPC가 `set_config('app.ledger_rpc', 'lesson-ticket', true)`를 켰다(`is_local = true`, 쓰기 직후 비움).
2. 바뀌는 행의 `source`가 `lesson-ticket`이다(수정·삭제는 기존 행도).
3. 호출자가 그 학원의 원장 또는 데스크다.

설정이 없을 때 `current_setting`이 NULL을 돌려줘 조건이 NULL이 되면 가드가 풀리므로 `coalesce(..., '')`로 맞춘다(2026-10-22 실제 Postgres 검증에서 발견한 결함). 브라우저의 직접 쓰기는 RLS(원장 전용)가 따로 막고, 데스크는 입출입내역 화면과 다른 출처의 수입 행에 접근하지 못한다.

추가로 `attendance_records`의 `guard_resolved_absence_attendance` trigger가 보강·패스로 처리된 결석의 상태 변경과 직접 삭제를 모든 역할에게 거부한다(학생 삭제 같은 연쇄 삭제는 허용).

## 민감 데이터

- 주민등록번호는 암호화해 저장한다(pgcrypto, Vault 키 `teacher_rrn_key`). 화면은 항상 마스킹하고 원문은 원장만 RPC(`reveal_teacher_resident_registration`)로 보며 열람마다 `audit_events`에 기록한다. 쓰기 RPC도 원장 전용이고, 일반 사용자의 직접 update로 값이 바뀌지 않게 트리거로 막는다. 암호문 컬럼은 원장·데스크가 직접 select할 수 있으나 키 없이 풀 수 없다.
- 상담 기록(아동 이름·나이·전화·학교)은 원장·데스크만 접근하며 선생님은 RLS까지 막는다. 접수 1년이 지나면 삭제한다. 쓰기 권한은 컬럼 단위로 줘서 접수일과 학원을 바꿀 수 없다.
- 급여와 결제 기록은 owner-only 기본값을 따른다.
- 원생 보호자 연락처는 기본적으로 owner/desk 전용이다. 선생님 노출은 사용자 확인 후 별도 정책과 column exposure로 확장한다.
- service-role 접근은 브라우저 코드에서 절대 사용하지 않는다.

## 수입 관리 RPC 권한 (2026-10-16 migration, 운영 적용)

수납·미납·입금 취소(`mark_fixed_income_snapshot_paid`/`_unpaid`/`_overdue`), 급여 지급·취소(`mark_salary_settlement_paid`/`cancel_salary_settlement_paid`), 교재 결제 완료(`complete_book_release_payment`)는 모두 `array['owner']`만 허용한다. 원장 ledger의 owner 전용 RLS·trigger(`require_finance_owner_for_ledger`)와 같은 기준이라, 데스크가 호출해도 한 곳에서 한국어 권한 오류로 끝난다. UI에서 버튼을 숨기는 것(`canRecordPayment` 등)은 편의일 뿐 권한 검증이 아니다.

## 교재 관리 RPC 권한 (2026-10-17 migration, 운영 적용)

`books`·`book_releases`는 브라우저에서 직접 insert/update/delete하지 못하고(권한 회수, select만 유지) 아래 RPC로만 바꾼다. 데스크가 `book_releases.status`를 `paid`로 직접 바꾸는 우회로를 막기 위한 것이다. 화면에서 버튼을 숨기는 것은 편의일 뿐이고 역할 검사는 서버 `private.assert_book_role`이 한다.

| RPC | 허용 역할 | 비고 |
| --- | --- | --- |
| `register_book_stock`, `update_book`, `delete_book` | owner, desk | 같은 도서명 재입고는 권수 합산, 삭제는 보관(`active=false`) |
| `register_book_release` | owner, desk | 재원 원생·보관하지 않은 교재만, 재고 차감. `p_status='paid'`(바로 결제 완료)는 owner만 |
| `update_book_release`, `delete_book_release` | owner, desk | 결제 대기만. 재고 복원·재차감, 삭제는 감사 기록 |
| `complete_book_release_payment` | owner | 입금일 ≥ 출고일, 입출입내역 수입 행 생성(owner 전용 원장 RLS와 같은 기준) |
| `cancel_book_release_payment` | owner | 사유 필수, 연결 수입 행 삭제, 대기 복귀, 감사 기록(개인정보 제외) |
