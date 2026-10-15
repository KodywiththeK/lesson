# 명세 검토 2회차: 레슨 시간표 기능명세서 (2026-10-15)

## 요약

- 목표: 사용자가 올린 "레슨시간표_기능명세서"(학원 레슨표 / 개인레슨표 / 회차권 관리)를 코드와 대조하고, 차이·모호함·정책 결정을 사용자에게 묻고, 명세에 없어도 당연히 필요한 부분을 보완한다. 명세는 코드를 모르고 쓰였으므로 코드 현실에 맞춰 해석했다.
- 방식: `/spec-review`. 먼저 이전 작업을 5개 커밋으로 정리한 뒤, 읽기 전용 조사관 3명(학원 레슨표 / 개인레슨표 / 회차권)이 병렬 조사 → 리드가 핵심 주장 재확인 → 사용자 결정 8건(2회 질문) → 약 3500줄이던 `lesson-management-workspace.tsx`를 동작 변경 없이 파일로 분리 → 파일 소유권을 나눈 구현 에이전트 4명(WP1 학원 레슨표, WP2 개인레슨표, WP3 회차권, WP4 월별 포스트잇)이 TDD로 구현 → 리드 통합·simplify → 독립 리뷰.
- 이 회차의 구현은 **커밋하지 않았다**(사용자가 요청할 때 커밋). 이전 작업 5개 커밋은 완료했다(57518e0, 0a22e06, 77213d0, e3c1cfc, c7f539b).
- DB migration은 처음에는 작성만 했으나, 사용자가 레슨표 조회가 `column lesson_events.time_unspecified does not exist`(400, 42703)로 막힌다고 보고해 **후속 작업에서 원격에 적용했다**(아래 "후속 작업" 참고).

## 사용자 결정(질문 2회, 모두 추천안)

| 주제 | 결정 |
| --- | --- |
| DB 방침 | migration 파일과 SQL 계약 테스트까지 작성, 적용은 별도 |
| 레슨 길이 | 원생 요일별 종료−시작에서 유도, 없으면 30분 |
| 담당 선생님 | `teachers.part`가 악기와 같은 선생님, 없으면 전체 재직 선생님+안내 |
| 메모지 | 월별 포스트잇 신규 추가, 날짜별 메모 유지 |
| 학원 출결 흐름 | 명세대로 도입(확인/취소 일괄 저장, 결석확인→사유서→최종확인), 마감 후에도 초기화로 수정 |
| 선생님 권한 | UI만 정리(학원 쓰기 버튼 숨김, 개인레슨 등록 불가), DB 권한은 현행 |
| 회차권 | 명세대로, 결제 금액은 선택 입력 |
| UI | 같은 달 안 드래그 이동 추가, 탭 구조·색·제목은 현행 유지 |

계획 단계에서 12개 가정을 함께 제시했고(`docs/product/open-questions.md`에 기록), 이의 없이 승인되었다.

## 조사 결과와 반영

| 조사관 | 핵심 발견 | 처리 |
| --- | --- | --- |
| 학원 레슨표 | 결석 처리 상태가 클라이언트에만 있어 새로고침하면 처리한 결석이 다시 나타나 **보강이 이중 생성될 수 있음(Critical)** | 반영(`resolve_academy_lesson_absence`가 서버에 처리 상태 기록·재처리 거부, 화면은 서버 상태를 읽음) |
| 학원 레슨표 | 출석이 즉시 저장(마감 없음), 사유서가 보강 1단계뿐(패스·최종확인·보강 시간 없음) | 반영(확인/취소 일괄 저장, 사유서 3단계, 최종확인) |
| 학원 레슨표 | 보강일 자동 추천·일정 삭제(사유)·요일별 인원확인·드래그 이동·월별 포스트잇 없음 | 반영 |
| 학원 레슨표 | 선생님에게도 쓰기 버튼이 보임 | 반영(UI만) |
| 개인레슨표 | 등록 폼이 시작·종료를 모두 입력, 충돌은 저장 시 오류만, 선생님 목록 전체 노출 | 반영(종료=시작+길이, 즉시 경고, 파트 필터) |
| 개인레슨표 | "등원 확인 취소" 없음, 회차 `1/4` 없음, 레슨원생 검색·선생님별 시간표 모달이 명세와 다름 | 반영 |
| 회차권 | 폼이 유효 시작·만료일 직접 입력+결제 금액 필수, 수정 기능 없음 | 반영(사용 기한 일수, 만료일 계산, 결제 금액 선택, 직접 수정) |
| 회차권 | 데스크가 결제 금액을 넣으면 회차권만 저장되고 원장 기록이 실패하는 **버그**, 재등록이 이전 결제 금액을 덮어씀 | 반영(`register_lesson_ticket`이 한 트랜잭션, 결제 금액 누적) |
| 회차권 | "만료 임박" 강조(명세는 잔여 2회 이하만) | 반영(만료 임박 제거, 만료 유지) |
| 공통 | 선생님 조회 범위 확대, 선생님↔악기 관계 테이블, 레슨 길이 컬럼, 충돌 DB 제약, 개인레슨 취소·삭제, 회차권 삭제 | **보류**(스키마·정책 필요, open-questions) |

## 변경 내용

### migration (작성만, 미적용)
- `supabase/migrations/20261016090000_lesson_schedule_workflows.sql`: `lesson_events.time_unspecified`, `monthly_memos.lesson_kind`와 `unique (academy_id, lesson_kind, month)`, `move_academy_lesson_event`(같은 달만), `resolve_academy_lesson_absence`, `delete_academy_lesson_event`, `cancel_private_lesson_attendance`.
- `supabase/migrations/20261016090100_lesson_ticket_registration_and_adjustment.sql`: `register_lesson_ticket`(병합·만료일 재계산·결제 금액 누적·원장 기록은 owner만), `adjust_lesson_ticket`(사유 필수, 조정 이력, audit).
- 모든 함수는 `has_academy_role` 검사, 한국어 예외, `revoke … from public, anon` 후 `authenticated`에 grant.

### 도메인(UI 밖 순수 로직)
- 신규: `academy-makeup-recommendation`, `academy-weekday-summary`, `academy-lesson-sheets`.
- 확장: `academy-lesson-absence`, `academy-lesson-attendance`, `private-lesson`(레슨 길이·종료 시간·선생님 파트 필터·충돌 안내·회차 라벨), `lesson-ticket`(만료일 계산·병합·직접 수정 검증, 잔여 부족 기준 2회), `monthly-memo`(자동 기록 문장·월별 포스트잇 위치·크기).

### API/화면
- `lesson-workspace.ts`(결석 처리·삭제·참석 인원 조회), `private-lessons.ts`(등원 확인 취소), `lesson-tickets.ts`(등록·수정), 신규 `lesson-monthly-notes.ts`. 데모 상태·provider를 같은 동작으로 맞췄다.
- 학원 레슨표: 출석 체크리스트, 결석인원·사유서·보강일 추천(ⓘ 툴팁), 삭제 다이얼로그, 요일별 인원확인 카드, 드래그 이동, 월별 포스트잇. 개인레슨표: 등록 폼 개편, 등원 확인 취소, `현재/총`, 레슨원생 검색·선생님별 시간표 모달(복사·초기화).
- 회차권: 등록 폼 분리(`lesson-ticket-registration-form.tsx`), 직접 수정 다이얼로그(`lesson-ticket-adjust-dialog.tsx`), 열 구성 개편, 잔여 2회 이하 강조.
- 정리: `lesson-management-workspace.tsx`를 약 3500줄에서 허브(약 1160줄)와 `src/features/lessons/` 하위 파일로 분리. 불일치하던 `src/lib/api/monthly-memos.ts` 삭제.

## 먼저 작성한 테스트(Red)와 한계

- 도메인·API·migration 계약 테스트는 실패하는 테스트를 먼저 쓰고 의도한 이유로 실패하는 것을 확인한 뒤 구현했다(예: 함수 미정의, `expected undefined`, 계약 문자열 부재).
- **Red를 확인하지 못한 항목(정직한 기록)**: WP1 UI 테스트 일부(학원 출석 체크리스트·삭제 다이얼로그·드래그 등 화면 테스트)는 구현과 함께 작성되어 Red 실패를 별도로 확인하지 못했다. 분리 리팩터링 직후 기존 테스트가 그대로 통과함을 동작 보존의 근거로 삼았다.
- **한계**: RPC TS 래퍼는 payload와 오류 변환만 단위 테스트했고, SQL은 문자열 계약 테스트(`schema-contract.test.ts`, 42건)뿐이다. 보강 멱등, 차감 복구, 병합 합산 등 **실제 DB 동작 테스트는 없다**.
- 기존 테스트를 약화하지 않았다. 요구가 바뀐 부분만 갱신했다(예: 만료 임박 → 만료, 버튼·다이얼로그 이름).

## 검증

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm typecheck` | 통과 | |
| `pnpm lint` | 통과 | |
| `pnpm test:run --reporter=dot` | 리뷰 반영 후 80개 파일 819개, 후속 작업 후 81개 파일 830개 통과 | 후속 작업 수치는 아래 참고 |
| `git diff --check` | 통과 | 문서의 줄 끝 공백 정리 후 |
| `pnpm test:e2e` | **실행하지 않음** | 사용자 지시로 브라우저 검증 생략. `tests/e2e/home.spec.ts`의 다이얼로그 이름("레슨원생 검색 및 선택", "레슨 일정 등록")은 코드를 읽고 갱신만 했다 |
| 브라우저(데스크톱/모바일) 확인 | **하지 않음** | 사용자 지시. 드래그 이동, 포스트잇 위치·크기 조절, 보강일 추천 툴팁, 모바일 레이아웃은 육안 확인이 없다 |

## 후속 작업: 사용자 결정 반영과 migration 적용 (2026-10-15)

독립 리뷰에서 나온 정책 질문 4건에 사용자가 답했다.

| 질문 | 사용자 결정 | 구현 |
| --- | --- | --- |
| 보강 일정 삭제·이동 시 결석 연결 | 삭제하면 보강 없이 결석(패스) 처리, 이동해도 결석과 연결 유지 | `delete_academy_lesson_event`가 연결된 결석 처리를 `pass`로 바꾸고 포스트잇에 기록, `move_academy_lesson_event`가 `absence_resolutions` 연결과 보강 표시·시간 미정을 새 일정으로 옮김. 화면은 `passAbsenceOfDeletedMakeup`, `toMovedAcademyAttendanceRow`로 같은 결과를 반영 |
| `현재/총` 월 경계 | 달이 바뀌어도 이어서 셈 | `fetchLessonWorkspaceData`가 회차권 유효 시작일 이후·조회한 달 이전의 같은 원생·악기 레슨 수(`priorLessonCount`)를 조회하고 `buildPrivateLessonSessionLabels`가 더함 |
| 처리된 결석의 서버 보호 | 막아 달라 | `attendance_records`에 `guard_resolved_absence_attendance` trigger(상태 변경·직접 삭제 거부, 연쇄 삭제는 `pg_trigger_depth() > 1`로 허용) |
| migration 적용 | 적용해 달라(레슨표 조회 400 해결) | CLI `db push`로 적용 |

- **원인 확인**: 400 응답 `column lesson_events.time_unspecified does not exist`는 코드가 새 컬럼을 select하는데 원격에 migration이 없어서 생긴 것이었다(리뷰 Warning #2에서 예견한 배포 순서 문제). 적용 후 컬럼이 존재한다.
- **Red 테스트**: 계약 테스트(보강 삭제·이동·trigger), `passAbsenceOfDeletedMakeup`, `toMovedAcademyAttendanceRow`(보강 유지), API의 `sourceLessonEventId`·`priorLessonCount`, 도메인 `priorLessonCount`를 먼저 쓰고 의도한 이유로 실패하는 것을 확인했다. 단 `(academy_id, month)` unique를 컬럼 기준으로 지우는 DO 블록의 계약 테스트는 테스트와 SQL을 연달아 수정해 Red를 별도로 확인하지 못했다.
- **migration 적용**: `pnpm supabase db push --dry-run`으로 대상이 두 파일뿐임을 확인한 뒤 `pnpm supabase db push --yes`. 원격 history `20261016090000`, `20261016090100`이 로컬 파일명과 일치한다. 읽기 전용 SQL로 확인한 결과: 컬럼 `time_unspecified`(boolean, 기본 false)·`lesson_kind`(text, 기본 `'academy'`) 존재, `monthly_memos`의 unique는 `(academy_id, id)`와 `(academy_id, lesson_kind, month)`만 남음, RPC 6종(`resolve_academy_lesson_absence`, `delete_academy_lesson_event`, `move_academy_lesson_event`, `cancel_private_lesson_attendance`, `register_lesson_ticket`, `adjust_lesson_ticket`) 존재, `guard_resolved_absence_attendance` trigger 활성(`tgenabled = 'O'`), 새 RPC는 authenticated 실행 가능·anon 불가, 옛 `create_makeup_lesson_event`는 authenticated 실행 불가. 이어서 `notify pgrst, 'reload schema'`로 스키마 캐시를 갱신했다.
- **하지 못한 검증**: 실제 학원 데이터로 보강 멱등·삭제 시 패스 전환·이동 시 연결 유지·trigger·회차권 병합을 확인하는 롤백 스모크 테스트를 시도했으나, 운영 데이터(학원·원장 조회) 읽기가 권한 분류기에 의해 거부되어 실행하지 않았다. SQL은 계약 테스트와 적용 시 문법 검사(트랜잭션)만 통과했고 **동작은 미검증**이다. 브라우저에서 레슨표가 다시 열리는지도 확인하지 않았다.
- **남은 위험**: trigger는 `pg_trigger_depth()`로 연쇄 삭제를 구분하므로 학생 삭제 흐름(`delete_withdrawn_student`)에서 출결 삭제가 막히지 않는지 실DB에서 확인되지 않았다. 학원 레슨 출결 저장이 처리된 결석을 포함하면 오류로 실패하고, 화면의 `academySheetsOverride`는 새로 조회한 결과를 무시하므로 오래된 화면은 갱신되지 않을 수 있다(open-questions).

## 독립 리뷰 결과와 처리

읽기 전용 리뷰 에이전트가 미커밋 변경 전체(두 migration의 모든 함수 본문, TS↔SQL 계약, 권한, 회귀)를 검토했다. SQL 문법·변수 선언·FK 힌트·RPC 파라미터명과 반환 키·권한 검사·도메인과 SQL의 일치는 문제를 찾지 못했다.

| 등급 | 발견 | 처리 |
| --- | --- | --- |
| Critical | 옛 `monthly_memos` unique(`monthly_memos_academy_id_month_key`)가 남아 개인레슨 포스트잇이 깨지고 결석 사유서 RPC 전체가 롤백될 수 있음 | **수정**(두 이름 모두 drop, 계약 테스트 Red→Green) |
| Warning | 시간 미정 보강을 이동하면 `time_unspecified`가 사라짐 | **수정**(시간을 바꾸지 않고 날짜만 옮길 때 유지, 계약 테스트) |
| Warning | 선생님에게 날짜 메모 탭이 남음(RLS상 실패) | **수정**(두 다이얼로그에서 숨김, 화면 테스트 Red→Green) |
| Warning | 옛 `create_makeup_lesson_event`가 호출 가능해 이중 생성·포스트잇 누락 우회 | **수정**(revoke, 계약 테스트) |
| Warning | 코드가 미적용 migration 컬럼에 의존(배포 순서) | runbook에 "migration 먼저 적용" 명시 |
| Suggestion | `p_valid_days` 상한 없음(`date out of range` 영문 오류) | **수정**(3650일 상한: SQL·도메인·폼, 도메인 테스트 Red→Green) |
| Suggestion | 미사용 `formatOriginLabel`(workspace-helpers) | 삭제 |
| Warning(정책) | 보강 일정 삭제·이동 시 결석 처리 연결 끊김, 처리된 결석의 서버 보호, 포스트잇 동시 편집, `현재/총` 월 경계 | **보류**, `open-questions.md`에 질문으로 기록 |
| Suggestion | 일괄 초기화 부분 실패 시 갱신, 시간 계산 자정 경계(SQL), 라벨표·`toSeoulIsoOffset` 중복, 미사용 도메인 함수(`markAllAcademyLessonAttendance`, `removeResolvedAbsenceFromQueue`), 워크스페이스 1164줄(훅 분리 여지), 드래그 되돌리기, 계약 테스트의 문자열 한계 | **보류**(현재 호출 경로에서는 문제 없거나 범위 밖). 아래 "남은 경고"와 함께 후속 정리 |

## Quality Consolidation

| 기준 | 결과 |
| --- | --- |
| 가독성 | 3500줄 단일 파일을 도메인별 파일로 분리하고 규칙(추천·요일 요약·만료일 계산·메모 문장)은 이름 있는 순수 함수로 뺐다. 화면에는 규칙 계산이 남지 않는다 |
| 예측 가능성 | 사용자 오류는 모두 `toUserMessage`를 거치고, 기본 날짜는 `getFinanceToday()`, 이름 정렬은 `compareKoreanNames`를 쓴다. 쓰기 버튼은 `canManage` 한 값으로 일관되게 숨긴다 |
| 응집도 | 보강 처리, 삭제, 포스트잇, 회차권 수정이 각각 훅·다이얼로그·API가 한 묶음으로 모여 있고 함께 바뀐다 |
| 결합도 | 허브(`lesson-management-workspace.tsx`)가 하위 컴포넌트에 props로만 연결하고 공유 타입은 `workspace-types.ts`로 모았다. 데모 provider와 운영 API는 같은 함수 시그니처를 따른다 |
| simplify 결과 | 어디에도 연결되지 않았던 `src/lib/api/monthly-memos.ts`를 삭제하고 월별 포스트잇 전용 API(`lesson-monthly-notes.ts`)로 대체했다. 아래 "남은 경고" 항목은 사유를 두고 남겼다 |

### 남은 경고(Warning, 사유 기록)
- `src/domain/private-lesson.ts`가 약 700줄이다. 개인레슨 규칙이 한 파일에 응집되어 있으나 길이·충돌·검색·복사 문장으로 나눌 여지가 있다. 이번 범위를 넘어서 분리하지 않았다.
- 고아 컴포넌트 `src/features/academy-lessons/academy-lesson-attendance-screen.tsx`가 남아 있다(이전부터 미연결). 삭제는 별도 정리 작업으로 둔다.
- 데모 포스트잇은 자동 기록 시 "메모를 저장했습니다." 토스트가 한 번 더 나온다(`appendLine` 훅 미통합).
- 시간 입력은 24시간제 `TimeField`다("오후 02:00" 표기 아님).
- 데스크톱 기본 위치의 포스트잇이 캘린더 위에 겹쳐 보인다. 사용자가 옮길 수 있으나 기본 위치는 육안 확인 후 조정이 필요하다.
- `현재/총`의 현재는 조회한 달 안의 순번이다(월 경계 질문은 open-questions).
- `lesson-workspace.ts`의 `absence_resolutions` embed 힌트(FK 이름)는 실제 DB에서 확인하지 못했다.

## migration 적용 전 체크리스트
`docs/engineering/supabase-migration-runbook.md`의 "적용 대기 migration 체크리스트" 참고. 요약: ① 기존 `monthly_memos` unique 제약 이름과 기존 행의 `lesson_kind` 채움 확인 ② `absence_resolutions` FK 이름 확인 ③ 함수 overload 충돌 확인 ④ MCP `apply_migration` 적용 후 원격 history timestamp에 맞춰 로컬 파일명 정정 ⑤ 실제 DB에서 보강 멱등·차감 복구·병합·결제 롤백을 수동 또는 DB 테스트로 확인.

## 남은 위험·미확정 질문
- migration 미적용(위). 적용 시점과 대상(운영/스테이징) 결정이 필요하다.
- 선생님 조회 범위 DB 확대, 선생님↔악기 관계, 레슨 길이 컬럼, 충돌 DB 제약, 개인레슨 취소·삭제, 회차권 삭제, `현재/총` 월 경계, 포스트잇 위치 저장은 `docs/product/open-questions.md`에 정리했다.
- 이번 구현분은 커밋하지 않았다.
