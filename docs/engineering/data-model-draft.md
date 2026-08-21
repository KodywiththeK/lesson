# 데이터 모델 초안

이 문서는 설계 초안이며 migration이 아니다. 실제 테이블 생성은 구현 phase에서 제품 정책과 최신 Supabase 문서를 확인한 뒤 진행한다.

## Tenant / Identity

- `profiles`: Supabase Auth 사용자와 연결되는 서비스 사용자 프로필
- `academies`: 가입자가 생성하거나 소속되는 음악학원 tenant
- `academy_members`: 사용자와 학원의 멤버십, 역할, 초대/활성 상태
- `teacher_accounts`: auth user와 학원별 선생님 레코드의 선택적 연결

## Role

- `owner`: 학원 전체 운영, 권한, 재무, 민감 정보 관리
- `desk`: 원생, 일정, 출석, 교재, 수납 같은 운영 관리
- `teacher`: 배정된 수업/원생 확인, 허용된 출석/보강 처리, 본인 급여 확인

## People

- `students`: 학원별 원생 핵심 정보와 상태
- `student_contacts`: 보호자/연락처 정보
- `student_instruments`: 원생의 악기별 수강 설정, 수업 형태, 담당 선생님, 요일, 진도, 수강료, 할인, 최종 수강료
- `teachers`: 학원별 선생님 정보와 민감 필드
- `teacher_salary_settings`: 월급제/시급제/비율제 급여 설정
- `vendors`: 학원별 거래처 정보

## Lessons

- `recurring_lesson_rules`: 학생 악기 설정에서 생성되는 반복 수업 규칙
- `lesson_events`: 날짜별 실제 수업 인스턴스
- `attendance_records`: 출석, 결석, 취소, 보강, 패스 상태
- `absence_resolutions`: 보강/패스 사유, 보강 날짜/시간, 메모
- `monthly_memos`: 월별 메모와 읽음 상태

## Tickets

- `lesson_ticket_grants`: 회차권 부여 수량, 유효기간, 등록일
- `lesson_ticket_adjustments`: 수동 수정과 사유 감사 로그
- `lesson_ticket_usages`: 출석 확인과 연결된 회차 차감 기록

## Books

- `books`: 학원별 교재명과 가격
- `book_inventory_batches`: 입고 수량과 입고일
- `book_purchase_requests`: 출고 전 구매 후보 목록
- `book_releases`: 출고되었지만 미결제인 판매 기록
- `book_payments`: 결제 완료 기록

## Finance

- `fixed_income_snapshots`: 월별 원생/악기별 고정 수입 스냅샷
- `payment_statuses`: 스냅샷별 수납/미납 상태
- `ledger_entries`: 수입/지출 source of truth
- `salary_settlements`: 월별 급여 계산과 지급 상태

## Audit

- `audit_events`: 상태 전환, 급여 지급, 수동 ledger 수정, 회차권 수정, 권한 변경 같은 민감 작업 기록

## 공통 필드 원칙

- 모든 운영 테이블은 `academy_id`를 가진다.
- tenant scope가 있는 핵심 참조 테이블은 `(academy_id, id)` 복합 unique key를 둔다.
- tenant scope child table은 단일 FK 외에 `(academy_id, *_id)` 복합 FK를 함께 둔다. RLS가 접근 권한을 막고, FK가 다른 학원 row를 잘못 연결하는 데이터 오염을 막는 이중 안전장치다.
- 사용자 소유가 아니라 학원 소속 데이터이므로 RLS는 `academy_members`와 배정 관계를 기준으로 작성한다.
- public schema의 기본 권한은 닫고, 앱에서 필요한 테이블만 `authenticated` role에 명시적으로 grant한다.
- `updated_at`이 있는 테이블은 공통 trigger로 실제 수정 시각을 갱신한다.
- 민감 정보 테이블은 role과 목적별로 SELECT column exposure를 별도 검토한다.
- 삭제보다 상태 전환과 audit 기록을 우선한다. 실제 영구 삭제 정책은 사용자 확인 후 정한다.
