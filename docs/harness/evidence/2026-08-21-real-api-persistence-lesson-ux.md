# 실제 API 지속 저장 및 레슨관리표 UX 보강 증거

## 목표
- 원생, 선생님, 거래처, 교재, 수입, 회차권, 레슨관리표 화면이 새로고침 후에도 유지되도록 실제 Supabase API 경로를 사용한다.
- 레슨관리표의 빈 오른쪽 영역을 제거하고 캘린더가 최대 폭을 쓰게 한다.
- 메모지는 인라인 패널 대신 다이얼로그에서 작성/저장한다.
- 개인레슨 등록 버튼은 개인레슨 탭 도구줄로 올린다.

## 변경 요약
- `AcademySessionGate`를 추가해 실제 실행 시 Supabase 로그인 세션의 활성 학원을 읽도록 했다.
- 테스트/E2E는 `NODE_ENV=test` 또는 `NEXT_PUBLIC_E2E_DEMO=1`일 때만 데모 데이터를 주입한다.
- 원생 등록은 `students`, `student_instruments`, `student_teacher_assignments`, 월간 `lesson_events`를 함께 생성한다.
- 개인레슨 출석은 `attendance_records` 저장, 출석 시 `lesson_ticket_grants.remaining_count` 차감, `lesson_ticket_usages` 기록까지 수행한다.
- 교재 출고는 `books`, `book_releases`를 저장하고 결제 완료 시 `ledger_entries` 수입을 자동 생성한다.
- 수동 입출입, 선생님, 거래처 등록을 실제 Supabase insert API로 연결했다.
- `monthly_memos`의 `academy_id, month` 유니크 제약을 추가해 메모 upsert를 안정화했다.

## Supabase 적용
- dry-run: `supabase db push --dry-run`
  - 적용 대상: `20260821132509_monthly_memo_unique_key.sql`
- 적용: `supabase db push`
  - 결과: `20260821132509_monthly_memo_unique_key.sql` 적용 완료
- 확인: `supabase migration list`
  - Local/Remote 모두 `20260821132509` 확인
- 참고: schema dump 검증은 Docker 데몬 미실행으로 실패해 마이그레이션 히스토리 확인으로 대체했다.

## 검증
- `pnpm test:run --reporter=dot`
  - 54 files, 227 tests passed
- `pnpm lint`
  - 통과
- `pnpm typecheck`
  - 통과
- `pnpm build`
  - 통과
  - 경고: 현재 Node.js 20 환경에서 향후 Supabase JS 지원 종료 경고가 표시됨
- `pnpm test:e2e`
  - 8 tests passed

## 남은 리스크
- 실제 원격 데이터 조회/저장은 Supabase Auth 계정과 `academy_members` 멤버십이 있어야 동작한다.
- 원격 샘플 데이터 적재는 별도 seed 적용 정책이 필요하다.
- 개인레슨 출석과 회차권 차감은 현재 클라이언트 순차 호출이다. 동시 출석 처리까지 강하게 보장하려면 DB RPC 트랜잭션으로 승격하는 것이 좋다.
