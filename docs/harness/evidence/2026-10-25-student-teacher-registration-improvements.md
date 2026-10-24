# 원생·선생님 등록 및 관리 개선 Evidence

## 요약

- 목표: 원생 나이·출생연도·학년 연동, 개인레슨 월 횟수·수업 길이·가격 정책, 공통 시간 입력, 선생님 계약기간·요일·비율제 입력을 운영 가능한 수준으로 개선한다.
- 완료한 변경:
  - 나이와 출생연도를 한국식 나이 기준으로 양방향 계산하고 미취학 학년과 자동 진급 규칙을 추가했다.
  - 개인레슨에 월 횟수와 회당 40·60분을 저장하고 요일별 시작 시간에서 종료 시간을 계산한다.
  - 체르니100 주 3일 금액을 160,000원으로 변경하고, 직접 입력 금액 보존·가격표 재계산·수업 형태 변경 시 금액 초기화 규칙을 분리했다.
  - 원생 상세에 할인 전 월 합계·매월 할인·최종 월 수강료를 표시한다.
  - 시간 입력은 `9`, `09`, `930`, `1530`을 각각 유효한 `HH:mm`으로 정규화하고 잘못된 입력은 오류와 함께 보존한다.
  - 원생 등록 중복 제출 방지와 출석번호 충돌 재시도를 추가했다.
  - 선생님 근무 요일을 월~일로 정렬하고 목록의 등록일을 계약기간으로 교체했으며, 비율제 입력을 0~10 정수 합계 10으로 제한했다.
  - 원생·수강 직접 쓰기 권한과 구형 하위 RPC 실행 권한을 회수하고 공개 wrapper RPC만 변경 경계로 남겼다. 휴원·퇴원·복귀 RPC는 내부 역할 검사를 유지한 `SECURITY DEFINER`로 전환했다.
- 커버한 요구사항: 2026-10-24 원생·선생님 피드백 1~9, 선생님 1~3, 공통 시간 입력 개선, 사용자 결정인 수업 형태 변경 시 가격표 금액 초기화.

## 먼저 작성한 테스트

- 테스트 파일:
  - `src/domain/student-grade.test.ts`
  - `src/domain/lesson-pricing.test.ts`
  - `src/domain/lesson-fee-draft.test.ts`
  - `src/domain/student-registration.test.ts`
  - `src/domain/student-list.test.ts`
  - `src/domain/teacher-list.test.ts`
  - `src/domain/teacher-salary-form-state.test.ts`
  - `src/components/operations/date-time-fields.test.tsx`
  - `src/features/students/student-registration-dialog.test.tsx`
  - `src/features/students/student-lesson-fee-fields.test.tsx`
  - `src/features/students/student-list-screen.test.tsx`
  - `src/features/teachers/teacher-list-screen.test.tsx`
  - `src/lib/api/students.test.ts`, `src/lib/api/private-lessons.test.ts`
  - `src/lib/supabase/student-teacher-registration-improvements-contract.test.ts`
  - `tests/e2e/home.spec.ts`
- 시나리오: 나이↔출생연도, 미취학 진급, 개인레슨 4·8회와 40·60분, 가격표와 수동 금액, 숫자 시간 입력, 등록 중복 방지, 상세 합계, 계약기간 네 형식, 요일 정렬, 정수 비율, RPC 권한 경계, 6개 화면 폭의 등록 다이얼로그.
- 초기 실패:
  - 요일 미선택 개인레슨의 월 횟수 안내가 무조건 `월 4회`로 보였다.
  - 수업 형태를 개인레슨으로 바꿀 때 월 횟수가 0이 되어 기본 가격 140,000원이 사라졌다.
  - 구형 하위 수정 RPC와 직접 테이블 쓰기 권한이 새 검증을 우회할 수 있었다.
  - 직접 UPDATE 권한 회수 뒤 `update_student_status`가 호출자 권한으로 실행돼 휴원·퇴원·복귀가 실패할 수 있었다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run --reporter=dot` | 통과 | 183개 파일, 2,099개 테스트 |
| `pnpm lint` | 통과 | 오류·경고 없음 |
| `pnpm typecheck` | 통과 | Next.js route type 생성 포함 |
| `pnpm test:e2e` | 통과 | Chromium 28개 시나리오 |
| `git diff --check` | 통과 | 공백 오류 없음 |
| 독립 diff 재검토 | Critical 없음 | 수정 전 Critical 3건을 반영한 뒤 재검토 |

전체 Vitest에서 Recharts가 jsdom의 0 크기를 알리는 기존 stderr 경고가 1회 출력됐지만 테스트는 통과했고 이번 변경 범위와 무관하다. E2E 빌드에서는 현재 Node.js 20 지원 종료 예정 경고가 출력됐다.

## 브라우저 증거

- URL: E2E demo의 `/management/students`, `/management/teachers`.
- 데스크톱 확인: 768, 1023, 1024px를 포함해 등록 다이얼로그가 화면 너비·높이 안에 있고 저장 버튼까지 스크롤로 접근됨을 확인했다.
- 모바일 확인: 320, 480, 767px에서 compact 작업 메뉴로 등록 다이얼로그를 열고 같은 조건을 확인했다.
- 비고: 목록 반응형 E2E도 320, 481, 768, 1024px에서 기존과 함께 통과했다.

## Supabase 증거

- Migration: `supabase/migrations/20261024233825_student_teacher_registration_improvements.sql`을 Supabase MCP로 운영 `lesson` 프로젝트에 적용했다. 원격 history version과 로컬 파일명을 `20261024233825`로 일치시켰다.
- RLS 확인: 기존 RLS를 유지하고 `students`, `student_instruments`의 authenticated 직접 insert/update 권한을 회수했다.
- 역할별 확인: 원격 카탈로그에서 새 공개 wrapper와 상태 변경 RPC의 authenticated 실행, anon 거부, 옛 등록 오버로드 거부, 직접 테이블 쓰기 거부, `SECURITY DEFINER` 경계를 확인했다.
- 스키마 확인: 새 컬럼 3개와 check constraint 4개가 존재하고 비정상 비율제 데이터는 0건이다. 적용 전 preflight에서도 비정상 비율제 데이터가 0건이었다.
- Advisor: 이번 역할 검사형 공개 RPC의 의도된 `SECURITY DEFINER` 경고 외에 기존 `private.lesson_ticket_refund_quote` search path와 leaked password protection 경고가 남아 있다.
- 비고: 실제 운영 데이터 mutation을 만드는 owner·desk JWT 스모크 호출은 하지 않았다. 앱에서 원장·데스크 등록·수정·상태 변경을 확인한다.

## 품질 정리

- 코드 단순화: 나이·출생연도·학년 입력을 `StudentDemographicFields`로 묶고, 가격 계산·요일별 월 횟수·수업 형태 전환을 순수 도메인 함수로 분리했다. 개인레슨 월 횟수 표시 helper로 0·1·2일 상태를 명확히 했다.
- 재사용한 추상화: `TimeField`, `StudentLessonFeeFields`, 기존 money draft parser, 공통 요일 순서와 API row adapter를 재사용했다.
- 테스트 정리: UI 구현 세부 대신 label·role·사용자 문구를 검증하고, migration 계약 테스트 이름을 실제 보장 범위에 맞췄다.
- 가독성: 나이/학년, 가격표, 계약기간, 비율 계산에 제품 언어를 담은 helper 이름을 사용하고 중첩 조건을 분리했다.
- 예측 가능성: 수동 레슨비는 명시적 재계산 전까지 보존하고 수업 형태 변경만 새 가격표로 초기화한다. 저장 실패 시 입력을 유지하고 중복 제출을 막는다.
- 응집도: UI는 draft와 표시를, 도메인은 계산·검증을, API는 row 변환을, migration은 권한·원자성·DB 검증을 담당한다.
- 결합도: 등록·수정 폼이 같은 demographic/fee 컴포넌트와 도메인 함수를 사용하며, 개인레슨 일정 화면은 저장된 수업 길이만 소비한다.
- simplify 결과: 월 횟수 표시 오류와 수업 형태 전환 기본값 충돌을 제거했고, 선생님 기본/급여 검증을 같은 선택 계약기간 규칙으로 맞췄다. 구형 RPC·직접 테이블 쓰기 우회를 없애고 정상 상태 변경 RPC는 별도 보안 경계로 보존했다.
- 코드 품질 리뷰: 독립 리뷰가 찾은 선생님 helper 권한, 구형 원생 RPC 우회, 개인레슨 길이 미사용, 계약기간 검증 의존, 상태 변경 권한 회귀를 모두 수정했다. 최종 재검토 Critical은 0건이다.
- 남긴 Warning/Suggestion: 원격 스키마·grant 검증은 완료했다. 실제 owner·desk JWT를 통한 등록·수정·상태 변경 스모크 확인은 남았다.
- 남은 부채: 새 wrapper가 기존 저장 RPC를 호출한 뒤 새 컬럼을 같은 트랜잭션에서 보완하는 구조다. 원자성은 유지되지만 후속 스키마 정리 때 핵심 저장 함수로 통합할 수 있다.

## 위험과 확인 질문

- 위험: DB migration은 앱 배포 전에 적용 완료했다. 배포 후 원장·데스크 계정의 실제 mutation 흐름을 확인해야 한다.
- 후속 질문: 없음. 개인레슨 일정 등록 화면의 월 횟수는 참고 정보이며 일정은 선택 날짜 한 건만 생성하는 것으로 제품 문서에 명시했다.

## Git

- 커밋: 사용자 요청에 따라 이 evidence와 함께 원생·선생님 등록 개선 기능 커밋에 포함한다.
- push 여부: 사용자 요청에 따라 `origin/main`에 반영한다.
