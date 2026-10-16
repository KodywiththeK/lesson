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
| 회차권 | 발급/수정/결제 입력 | 금액 없이 발급/수정(사유 필수, 이력 기록) | 담당 원생의 담당 악기 잔여 회수·만료일만 개인레슨표에서 조회 |
| 원생 | 전체 관리 | 전체 관리 | 담당 원생 기본정보만, 보호자 연락처 제외 |
| 선생님 | 전체 관리 | 확인 필요 | 본인 정보만 |
| 거래처 | 전체 관리 | 전체 관리 | 접근 불가 |
| 교재 | 전체 관리 | 전체 관리 | 접근 불가 |
| 수입 관리 | 전체 관리 | 확인 필요 | 본인 급여만 |

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
- teacher의 "내 급여" 링크는 화면(`/my/payroll`)과 teacher용 select 정책이 생길 때까지 숨긴다. `allowDeskFinance` 플래그는 세션에서 채워지지 않아 실제로는 꺼져 있다. 회차권 수동 수정은 원장·데스크 모두 허용하며 별도 desk 플래그를 쓰지 않는다.
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
| `register_lesson_ticket` | owner, desk | 결제 금액은 owner만, desk가 금액을 넣으면 전체 롤백 |
| `adjust_lesson_ticket` | owner, desk | 사유 필수, 조정 이력과 audit 기록 |

추가로 `attendance_records`의 `guard_resolved_absence_attendance` trigger가 보강·패스로 처리된 결석의 상태 변경과 직접 삭제를 모든 역할에게 거부한다(학생 삭제 같은 연쇄 삭제는 허용).

## 민감 데이터

- 주민등록번호는 구현 전 사용자 확인이 필요하다.
- 급여와 결제 기록은 owner-only 기본값을 따른다.
- 원생 보호자 연락처는 기본적으로 owner/desk 전용이다. 선생님 노출은 사용자 확인 후 별도 정책과 column exposure로 확장한다.
- service-role 접근은 브라우저 코드에서 절대 사용하지 않는다.
