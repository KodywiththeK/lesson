# 2026-11-27 대시보드 오늘 할 일 요약 칸 + 처리 모달

## 요약

- 목표: 대시보드에서는 업무별로 몇 건인지만 보이고, 칸을 누르면 모달에서 한 건씩 확인·이동·연락·처리한다.
- 완료한 변경:
  - 도메인 `src/domain/daily-tasks.ts`
    - `groupDailyTasks`: 업무 5칸 + 답변 대기 칸
    - 역할별 처리 정보(`action`)와 연락처(`contact`)
    - 역할 거르기를 `limitToRole` 한 곳으로 모음
    - `dailyTaskLinkLabel`, `toAbsenceResolutionRow`, `DailyTaskStateChange`
  - 결석 사유서 검사·저장 요청 `buildAbsenceResolutionRequest`(`src/domain/academy-lesson-absence.ts`): 레슨표와 대시보드가 같이 쓴다. 레슨표의 `resolveAbsence`가 이 함수를 쓰도록 바꿨다.
  - 화면
    - `today-tasks.tsx`: 6칸 요약
    - `today-task-group-dialog.tsx`: 칸 목록 모달
    - `today-task-actions.tsx`: 처리 부분. 수강료 입금, 회차권 입금, 교재 입고, 회차권 재등록, 보강·패스
    - `today-task-processing.ts`: Supabase 처리 함수. 데모·테스트는 바꿔 끼운다.
  - 공용 부품 `ResponsiveDialog`: PC는 Dialog, 휴대폰은 아래 시트(Drawer)
  - 회차권 등록 폼에 `initialStudentId`·`initialInstrumentId` 미리 채우기 추가
  - 공용 함수
    - `fetchPreparedAttendeeCounts`(`src/lib/api/lesson-workspace.ts`): 공휴일 준비 + 등원 인원. 레슨표와 같이 쓴다.
    - `formatSeoulDateTime`(`src/domain/finance-date.ts`): 레슨 변경 이력과 같이 쓴다.
  - migration `supabase/migrations/20261127000000_daily_task_actions.sql`
    - `private.daily_task_source`에 처리용 id·시간·정규 요일과 대표 연락처를 더함
    - 원장·데스크 범위만 연락처를 채운다
  - 데모 처리(`src/lib/demo/daily-tasks-demo.ts`): 처리하면 데모 원천에서 빠진다.
- 커버한 요구사항: 사용자 결정 2026-11-27
  - 업무별 5칸 + 답변 대기 칸
  - 휴대폰 아래 시트
  - 입금·입고·보강(추천 포함)·재등록을 모달에서 바로 처리
  - 교재 미결제는 이동만
  - 상담·학부모 전화·문자는 원장·데스크만

## 먼저 작성한 테스트

- `src/domain/daily-tasks.test.ts`
  - 역할별 처리·연락처
  - 칸 묶기
  - 결석 행 변환
  - 초기 실패: 기존 구현에서 8건 실패를 확인한 뒤 구현했다.
- `src/domain/academy-lesson-absence.test.ts`: `buildAbsenceResolutionRequest` 3건. 초기 실패: `is not a function`.
- `src/features/dashboard/today-tasks.test.tsx` 10건
  - 칸 건수, 0건 칸 비활성, 선생님 칸
  - 모달 금액·버튼, 데스크 수강료 처리 없음
  - 전화·문자 링크
  - 답변 대기 이동
  - 입금 처리 후 칸이 줄어듦
  - 보강 추천에서 정규 요일 제외
  - 재등록 미리 채우기·저장
  - 휴대폰 시트
  - 기존 탭 UI 테스트를 새 동작으로 바꿔 썼다.
- `src/features/lesson-tickets/lesson-ticket-registration-form.order.test.tsx`: 미리 채우기
- `src/lib/supabase/daily-task-actions-contract.test.ts`: 연락처는 원장·데스크만, 금액·선생님 규칙 유지, 대표 연락처 1건, 트랜잭션
- `tests/e2e/home.spec.ts`
  - 교재 입고 칸 → 모달 → 입고 확인 → 0건
  - 375px 시트·전화 링크

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm typecheck` | 통과 | |
| `pnpm lint` | 통과(경고 0) | |
| `pnpm test:run` | 282 파일 / 2640 테스트 통과 | simplify 뒤 다시 실행 |
| `pnpm test:e2e` | 43 통과 | 새 2건 포함, simplify 뒤 다시 실행 |

## 브라우저 증거

- URL: `NEXT_PUBLIC_E2E_DEMO=1` 빌드 + `next start -p 3100`의 `/`
- 데스크톱(1280): 6칸 요약, `돈 챙길 일` 가운데 창, 수강료 입금 창이 모달 위에 열림
- 모바일(375): 2열 칸, `보강 잡기` 아래 시트, 결석 사유서 창이 시트 위에 열림. 패스로 확정하자 시트에 빈 안내가 나오고 칸이 `보강 잡기 0건`으로 바뀌었다.
- 콘솔 오류 없음
- 비고: 데모는 처리 함수를 데모용으로 바꿔 끼운다. 실제 저장(입금·입고·보강·재등록 RPC)은 각 화면이 이미 쓰는 API를 그대로 부르지만, 운영에서 원장 계정으로 한 번씩 확인해야 한다.

## Supabase 증거

- 로컬 실행 검증(Docker 로컬 Supabase, `db reset --local`)
  - migration 전체와 seed가 오류 없이 적용됐다.
  - 롤백 트랜잭션에서 결석·상담을 넣고 `private.daily_task_source`를 원장·데스크·선생님 범위로 실행했다.
    - 결석 원천에 `lessonEventId`·`startsAt`·`endsAt`·`instrumentId`·`teacherName`·`absenceReason`·`regularWeekdays`·`contact`가 들어온다.
    - 상담 전화번호와 학생 연락처는 원장·데스크만 받는다. 선생님 범위에는 상담이 없다.
- 운영 적용(2026-11-27, 사용자 요청)
  - CLI `db push --remote=<ref> --dry-run`으로 대상이 `20261127000000_daily_task_actions.sql` 1건뿐임을 확인한 뒤 `--yes`로 적용했다.
  - 원격 이력 81건이 로컬과 모두 일치하고 마지막 버전은 `20261127000000`이다.
  - 실제 함수 정의에 `v_with_contacts`가 있다.
  - `private.daily_task_student_contact`는 `authenticated` 실행 권한이 없다(`has_function_privilege` false).
- 역할별: 연락처·상담 전화번호는 `v_with_contacts`(원장·데스크)일 때만 채운다. 금액(`v_with_amounts`)과 선생님 범위 규칙은 그대로다.

## 품질 정리

- 코드 단순화(`/simplify`, 재사용·단순화·효율·높이 4관점 병렬 검토 후 반영)
  - 보강 추천 달 계산: `findMakeupWindowMonths`를 재사용
  - 공휴일 준비 + 등원 인원: `fetchPreparedAttendeeCounts`로 공용화
  - 상태 시각 표시: `formatSeoulDateTime`으로 공용화(24시간제 고정)
  - `as never` 캐스트: API별 첫 인자 타입(`clientFor<typeof api>()`)으로 교체
  - 회차권 입금 특례를 카드 밖으로 뺐다. `TodayTaskActionControl` 하나가 칸 카드의 처리를 모두 맡는다.
  - 역할 거르기를 `limitToRole` 한 곳으로 모으고, 이동 버튼 이름을 href에서 구한다.
  - 중복 제거
    - `DialogAction`·`StateChange` 타입 중복
    - 결석 검사의 시간 계산 이중 실행
    - 결과의 `resolution`·`targetDate` 중복
  - 처리 뒤 다시 읽기: 학원 범위는 낡음 표시만 하고 할 일 원천만 바로 다시 읽는다.
  - 데모: 제네릭 `remove`와 캐스트를 일반 spread로 바꿨다. 발주 데모 값을 원천에서 읽는다.
- 건너뛴 것(사유)
  - `useMutation`의 `mutationFn` 감싸기 유지: TanStack이 둘째 인자(context)를 넘겨 처리 함수가 입력 하나만 받는다는 계약이 깨진다. 테스트도 이 계약에 기댄다.
  - 카드사 목록 query options 팩토리 미사용: 처리 함수를 바꿔 끼우는 구조라 loader를 유지했다. key는 같은 `queryKeys.settings.cardFeeRates`다.
  - `loadBookOrder`가 전체 발주를 읽고 하나를 찾음: 단건 RPC는 스키마 추가가 필요해 보류했다. 학원 규모에서는 비용이 작다.
  - SQL 정규 요일 상관 서브쿼리·행마다 연락처 함수 호출: 학원 규모에서 수 ms다. 가독성을 위해 유지했다.
- 가독성: 칸 묶기·역할 거르기·연락처·결석 변환은 도메인 순수 함수가 맡고, 화면은 조합만 한다. 처리 종류는 `ActionDialog`의 switch 한 곳에 모았다.
- 예측 가능성
  - 처리 권한은 서버 RPC와 `limitToRole`이 같은 기준을 쓰고 테스트로 고정했다.
  - 연락처·금액은 서버 한 곳에서 거른다.
  - 결석 저장 요청은 레슨표와 같은 함수로 만든다.
- 응집도: 대시보드 모달 관련은 `src/features/dashboard/today-task-*`, 반응형 모달만 shared에 둔다.
- 결합도
  - 처리 창은 각 화면 부품의 props로만 연결한다(결석 사유서, 입고 창, 입금 창, 등록 폼, 회차권 입금 버튼).
  - 대시보드는 레슨표 화면 상태에 의존하지 않는다.

## 남은 위험·질문

- 실제 저장(입금·입고·보강·재등록)은 운영에서 원장 계정으로 한 번씩 확인해야 한다.
- 학생 연락처가 여러 개면 가장 먼저 등록한 번호만 쓴다(사용자 결정).
- 보강 추천은 결석일 앞뒤 4주의 정규 일정으로 정규 요일을 정한다. 레슨표는 보고 있는 달의 행을 쓰므로 경계 달에서 추천이 조금 다를 수 있다.
