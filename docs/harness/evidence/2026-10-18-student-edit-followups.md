# 원생 수정 후속 한계 3건 해소 (2026-10-18)

## 요약

- 목표: 직전 작업에서 남긴 위험 3건 해소. (A) 종료한 악기를 다시 추가하면 예전에 열어 보지 않은 달의 월 수강료가 빠지는 문제, (B) 기존 수강의 수업 형태 변경이 서버 규칙·등록 정책과 어긋나는 문제, (C) 목록 `studentOverrides`가 서버 재조회보다 우선해 다른 사용자의 변경이 늦게 반영되는 문제.
- 완료한 변경:
  - A(사용자 결정: 기간마다 새 수강 행): `20261020090000`(미적용 상태에서 제자리 수정)에서 수강 unique를 활성 행 한정 partial unique index로 교체(이전 unique는 컬럼 집합으로 찾아 drop), `insert_student_enrollment`는 되살리기를 폐기하고 항상 새 행을 insert(활성 중복 거부, 종료일 당일 이전 재시작 거부), 충돌 검사는 활성 행만, 월 수강료 snapshot은 늦게 시작한 수강 우선·시작 전 종료 수강 제외. 도메인 `applyStudentEnrollmentSave`의 되살리기 특례 삭제, 데모는 새 id의 새 수강과 서버 순서(종료 → 수정 → 추가) 충돌 검사.
  - B(사용자 결정: 등록과 같은 정책): 수정 폼의 수업 형태 선택지를 `getLessonTypeChoices`로 계산(피아노만 학원레슨·개인레슨, 현재 값은 유지, 저장 후 모습 기준 충돌은 비활성 + 이유). 추가 선택지도 같은 판단(`getEffectiveEnrollmentKeys`)을 쓴다. 문구는 "학원레슨/개인레슨"으로 통일.
  - C: `useStudentRowOverrides`가 override를 만든 시점의 목록 데이터 참조에 묶어, 재조회로 데이터가 바뀌면 버리고 같으면 유지한다. 상세 창은 목록에 같은 원생이 있으면 그 행을 우선 보인다.
- 커버한 요구사항: 사용자 결정(A 기간별 새 행, B 등록과 같은 정책), 이전 evidence의 남은 Warning(W2·W-3·S-2). 문서: functional-spec, acceptance-scenarios, traceability-matrix, open-questions(3건 해소), decision-log(3행), supabase-migration-runbook.
- 연결된 인수 시나리오: acceptance-scenarios의 "원생 수정"(재추가는 새 수강 행, 이전 달 수강료 보존, 수업 형태 선택지, override 폐기).

## 먼저 작성한 테스트

- 테스트 파일: `src/lib/supabase/student-enrollment-edit-contract.test.ts`, `src/domain/student-enrollment-edit.test.ts`, `src/lib/demo/academy-demo-student-edit.test.ts`, `src/features/students/student-enrollment-edit-state.test.tsx`, `student-edit-enrollment.test.tsx`, `student-row-overrides.test.tsx`, `student-list-screen-overrides.test.tsx`.
- 시나리오: 활성 한정 unique index와 이전 unique drop(컬럼 집합), 새 행 insert와 종료 행 비덮어쓰기, 종료일 당일 이전 재시작 거부, 활성 행만 충돌, snapshot 정렬·시작 전 종료 제외, 데모의 새 id와 수정 후 모습 기준 충돌, 수업 형태 선택지(비피아노 개인 전용·현재 값 유지·상호 충돌·종료 예정 조합 유지), override가 같은 데이터면 유지·다른 데이터면 폐기·상세 스냅샷 갱신.
- 초기 실패: 계약 테스트 6건(활성 한정 unique 등)과 재검토 후 3건, 데모 2건, 화면 상태·UI 테스트와 override 통합 테스트가 의도한 이유로 먼저 실패했다. 예외: 도메인의 되살리기 특례 삭제는 기존 테스트를 새 의미로 바꿨고 구현 전후 모두 통과하는 단순화(리팩터링)였다. 화면의 "충돌이 없으면 payload 불변"과 일부 override 회귀 테스트는 처음부터 통과하는 보호용이다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm supabase migration list` | 원격에 `20261020090000`·`20261020090100` 없음 | 읽기 전용, 제자리 수정 근거 |
| `pnpm typecheck` / `pnpm lint` | 오류 없음 | |
| `pnpm test:run --reporter=dot` | 143개 파일, 1810개 테스트 통과 | 마지막 수정 후 |
| `git diff --check` | 문제 없음 | |
| 브라우저·E2E·`pnpm build` | 실행하지 않음 | 이전 지시 유지 |

## Supabase 증거

- 독립 SQL 재검토(읽기 전용 에이전트): Critical·필수 Warning 없음. DO 블록 문법·타입, 제약 오삭제 없음(PK·FK·`(academy_id, id)` unique 유지), 이 unique를 참조하는 FK와 conflict target 없음, 모든 `student_instruments` 읽기 쿼리가 `active`를 필터해 종료 행 공존에 안전함을 확인했다. 지적 W-1(같은 날 종료 후 재추가 시 오늘 출석 처리한 일정과 중복)은 재시작을 종료일 다음 날부터로 막아 반영, S-1(동률 정렬)은 `created_at desc, id desc` 추가, S-2(시작 전 종료한 수강이 청구됨)는 snapshot 조건 추가로 반영했다. S-3(같은 저장에서 두 수강의 수업 형태 맞바꿈)은 서버가 순차 검사해 거부하고 화면도 서로의 현재 값을 막아 같은 결과라 유지한다. S-4는 아래 남은 위험.
- 적용(사용자 요청, 2026-10-18): `migration list`(원격에 없음) → `db push --dry-run`(대상 2개뿐) → `db push --yes` 성공. 읽기 전용 카탈로그 확인: 옛 unique 제약이 사라지고 PK·`(academy_id, id)` unique·활성 한정 unique index만 남음, `started_on`·`ended_on` 존재, `update_student_with_enrollments` authenticated만 실행 가능, private 함수 3개 anon·authenticated 실행 불가, 출결 래퍼는 7인자 하나(오버로드 없음), snapshot 함수에 시작·종료 달 조건과 정렬 포함.
- 한계: 운영 데이터 행은 읽지 않았다. 원자 롤백, 시리즈·일정 취소, 활성 행·종료 행 공존과 재추가, snapshot 결과, 결석 재호출의 회차권 영향은 앱에서 직접 확인해야 한다.

## 품질 정리

- 코드 단순화: 서버의 되살리기 분기·주간 일정 교체 코드, 도메인의 `keptIds` 특례, 화면의 `studentOverrides` state를 삭제했다. 수강 한 건 추가가 항상 insert 한 가지 경로가 되었다.
- 재사용한 추상화: 추가 선택지와 기존 섹션 선택지가 같은 충돌 판단(`isLessonTypeTaken`/`getEffectiveEnrollmentKeys`)을 쓴다. 학원레슨·개인레슨 문구는 `STUDENT_LESSON_TYPE_LABELS` 하나로 통일했다.
- 테스트 정리: 되살리기를 전제한 계약·데모·도메인 테스트를 새 행 의미로 교체했다(약화 아님).
- 가독성: SQL은 단계 주석으로 의도를 적었고 override 생명주기는 `student-row-overrides.ts` 한 파일에 있다.
- 예측 가능성: 재추가는 항상 새 행·새 id, 충돌은 서버·데모·화면이 "저장 후 모습, 활성 행만" 기준으로 같다. override는 참조 비교로 폐기 시점이 정해진다.
- 응집도: 충돌 규칙은 `student-enrollment-edit-state.ts`와 서버 insert/update 한 곳에 모였다.
- 결합도: 섹션 컴포넌트는 선택지 prop만 받고, 화면은 훅의 `apply`·`resolve`만 안다.
- simplify 결과: 쓰지 않는 import(`findActiveEnrollmentConflict`)와 특례를 제거했다.
- 코드 품질 리뷰: SQL 독립 재검토 1회(Critical 없음).
- 남긴 Warning/Suggestion(사유):
  - S-4 `update_student_profile_from_date`는 종료한 수강 id로 직접 RPC 호출하면 시리즈를 다시 만들 수 있다(owner·desk만 호출 가능). 앱 경로(`update_student_with_enrollments`)는 막혀 있어 이번 범위에서 함수를 다시 정의하지 않았다. 후속에 `and active` 가드를 추가한다.
  - 열려 있는 수정 폼은 열 때의 값으로 한 번만 초기화되어, 폼을 연 사이 서버가 바뀌어도 입력은 유지된다(기존 동작).
  - 검색·페이지로 쿼리 키가 바뀌었다 돌아오면 캐시된 낡은 값이 재조회 전까지 잠깐 보일 수 있다.
  - 이전 evidence의 S-2·S-5(접근성, 중복 정리)·S-7은 그대로 후속.
- 남은 부채: 등록 RPC와 `insert_student_enrollment`의 수강 삽입·검증 중복, `database.types.ts` 재생성.

## 위험과 확인 질문

- 위험: SQL 실제 동작 미검증(적용 후 확인). 종료 후 같은 악기를 다시 추가하면 회차권 잔액은 악기 키로 이어진다. 월 수강료는 수강 기간마다 따로 만들어지지만 snapshot 키가 악기라 같은 달 겹침은 늦게 시작한 수강 한 건이다.
- 후속 질문: 피아노 외 악기의 학원 수업 허용 여부는 이번에 결정하지 않았다(등록과 같은 정책 유지).

## Git

- 커밋: `fe5f9d5`(migration·계약 테스트), `ece8064`(nav 하위 메뉴 표시), `66c4f9b`(월 결석인원·개인레슨 결석 사유), `a553849`(원생 수정), `cff8395`(문서). 이전 evidence의 미커밋 작업(월 단위 결석인원, 복수 악기 수정, 툴바 정리, 교재 하위 탭 표시)도 함께 커밋했다.
- migration 적용: 사용자 요청으로 `20261020090000`·`20261020090100`을 2026-10-18 운영 DB에 적용했다(위 Supabase 증거).
- push 여부: 하지 않음.
