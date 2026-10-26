# 레슨시간표·회차권 예약 흐름 개선 완료 증거

## 범위와 연결 요구사항

- 사용자 확정 계획(2026-10-26): 날짜·악기·원생 순서의 개인레슨 등록, 회차권 선예약과 등원 시 실제 차감, 일정 수정·숨김 삭제·같은 달 드래그 이동, 결석 취소, 악기별 색상, 공휴일·휴원일, 숨긴 일정 설명, 회차권 등록의 악기 우선 선택.
- 인수 시나리오와 추적표는 `docs/product/acceptance-scenarios.md`, `docs/product/traceability-matrix.md`에 연결했다. 기존에 진행 중이던 카카오 인증·온보딩 변경은 보존했다.

## 발견 → 계획

- 기존 개인레슨 등록은 회차권이 없어도 후보에 나타났고, 일정 등록만으로 예약 가능 횟수가 줄지 않았다. 출결 RPC만 실제 회차권을 차감하는 구조였다.
- 변경 경계는 예약 검증용 DB 트리거/RPC, 개인레슨 화면과 회차권 등록 화면, 학원 공통 달력 설정으로 나눴다. 기존 회차권 결제·환불 정책과 학원 레슨 출결 규칙은 유지했다.
- 코드 품질 계획: **가독성**은 날짜·악기·원생 단계와 서버 검증을 명명된 함수로 분리하고, **예측 가능성**은 예약과 실제 잔여를 별도 값으로 보여 주며, **응집도**는 예약·색상·휴원 규칙을 각 도메인/설정 API에 두고, **결합도**는 기존 시간표 데이터와 숨긴 취소 기록을 분리한다. **simplify 결과**는 최종 변경 파일 재검토 후 기록한다.

## Red → Green → Refactor

- 예약 계산·날짜 경계, 색상 대비, 휴원 반복 규칙, 공휴일 응답/오류, 등록 순서, 일정 수정·삭제, 결석 취소, 휴원일 확인, 달력 상태·색상·숨긴 기록, SQL/RLS 계약 테스트를 먼저 추가하고 각 대상 테스트의 의도한 실패를 확인했다.
- 적용 전 재검토에서 개인레슨 직접 삭제 방어와 매주 반복 휴원 종료일 필수를 추가했다. SQL 계약·설정창·설정 API 테스트가 각각 의도한 이유로 실패한 뒤 트리거와 DB 제약, 화면·API 검증을 보완했다. 기존 `lesson_events`의 직접 DELETE 권한은 이미 회수되어 있으며 트리거는 서버 경계의 추가 방어다.
- 예: `src/features/private-lessons/private-lesson-registration-form.reservation.test.tsx`는 휴원일 안내 누락으로 실패했고, `src/features/lessons/lesson-month-calendar.test.tsx`는 공휴일 이름 누락으로 실패했다. `src/lib/supabase/private-lesson-reservation-contract.test.ts`는 동시 등록 후 최신 스냅샷을 읽는 `volatile` 함수가 없어 실패했다.
- DB 마이그레이션은 학원·원생·악기별 트랜잭션 잠금 뒤 예약 가능 회차를 다시 조회한다. 일정 변경·회차권 축소/삭제·결석 취소는 같은 한도를 검사한다. 개인레슨 수정·숨김 삭제 RPC는 원장·데스크만 실행하고 감사 이력을 남긴다.
- 색상 배경·글자색 계산을 `getInstrumentColorStyle`로 정리해 달력·일별 표·출석창의 중복 계산을 제거했다. 취소 일정은 기본 출결 목록에서 분리해 달력의 숨긴 건수에 포함했다. 휴원일 수정 후 새 휴원일 입력으로 돌아가는 동작을 추가했다.

## Verify

- `pnpm lint`: 통과.
- `pnpm typecheck`: 통과.
- `pnpm test:run`: **202개 파일, 2,145개 테스트 통과**.
- `NEXT_PUBLIC_E2E_DEMO=1 pnpm build --webpack`: 통과.
- `NEXT_PUBLIC_E2E_DEMO=1 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/lesson-schedule-improvements.spec.ts --workers=2`: Chromium **31개 통과**. 데스크톱·320px 모바일의 설정창, 8개 기본 색, 직접 색상 선택, 반복 휴원 입력, 회차권 악기 우선 선택을 확인했다.
- 화면 캡처: `test-results/lesson-schedule-improvements-개인레슨-달력과-시간표-설정이-데스크톱에서-보인다-chromium/private-calendar-settings-desktop.png`, `test-results/lesson-schedule-improvements-모바일에서도-악기별-색상과-휴원일-설정을-열-수-있다-chromium/private-calendar-settings-mobile.png`. 전환 애니메이션 종료 후 직접 확인했다.
- 재검토 후 `NEXT_PUBLIC_E2E_DEMO=1 pnpm exec playwright test tests/e2e/lesson-schedule-improvements.spec.ts --workers=2`: Chromium **3개 통과**. 최초 시도는 샌드박스의 로컬 포트 제한으로 서버가 시작하지 못했으며 승인된 로컬 실행에서 통과했다.
- Supabase `lesson` 프로젝트(`zkzqmqtzzlgljkuctpbn`)에 이번 레슨시간표 migration **한 건만** MCP `apply_migration`으로 적용했다. 원격 version은 `20261026130428`이며 로컬 파일명을 맞췄다. 별도 온보딩 migration은 미적용 상태로 보존했다.
- 적용 전후 예정 개인레슨 **36건**, 회차권 **8건**이 유지됐다. 기존 예약이 잔여보다 1건 많은 조합 1개도 유지했다. 새 트리거 3개, 설정 테이블 2개, `academy_closures.ends_on NOT NULL`, RLS·GRANT, 공개 RPC의 authenticated 실행·anon 거부를 실제 schema SQL로 확인했다.
- 원장 JWT·`authenticated` 역할을 모사한 롤백 트랜잭션에서 예약 가능 조회 8행, 초과 예약 추가 거부, 예정 일정 수정·숨김 삭제 RPC, 휴원일 쓰기 성공을 확인했다. 비회원 JWT의 휴원일 쓰기와 직접 개인레슨 삭제는 거부됐다. 롤백 뒤 운영 데이터에 검증 행이 남지 않았다. 활성 선생님 계정은 없어 선생님 실계정 호출은 검증하지 못했다.
- Supabase Security Advisor는 새 공개 `SECURITY DEFINER` RPC 3개를 경고한다. 각 RPC는 `auth.uid()`와 학원 역할을 검사하므로 의도된 API 경계다. 설정 테이블 두 곳의 읽기·쓰기 정책 중복은 Performance Advisor 경고로 남았다. 새 범위 인덱스의 미사용 경고는 테이블이 비어 있기 때문이다.

## Consolidate

- **가독성:** 개인레슨 등록 단계, 예약 표시, 색상 상태, 휴원일 확인 문구가 사용자 흐름 순서대로 읽히는지 변경 파일을 다시 확인했다. 기존 시간표의 큰 워크스페이스 컴포넌트에는 설정 조회·저장 코드가 늘어난 점이 남아 있다.
- **예측 가능성:** 등록은 예약 가능 횟수만 줄이고 등원에서만 실제 회차를 차감한다. 결석·취소·삭제의 예약 해제, 출결 후 수정 제한, 휴원일 추가 확인은 서버/화면 경계에 분명히 둔다.
- **응집도:** 예약·색상·휴원·공휴일 계산은 각각 도메인 함수, 저장과 권한은 DB/API에 배치했다. 공휴일 키는 서버 환경변수 `KASI_HOLIDAY_API_KEY`로만 읽는다.
- **결합도:** 숨긴 취소 기록은 일별 출결과 분리했고 새 달력 설정은 학원별 테이블·RLS로 제한했다. 기존 카카오 인증·온보딩 변경과 회차권 결제 로직은 건드리지 않았다.
- **simplify 결과:** 악기 색상 스타일 중복을 한 함수로 줄였고, 휴원일 수정 초안을 초기화할 수 있게 했다. 린트·타입·전체 테스트·브라우저 테스트를 다시 실행했다.

## 남은 위험과 적용 조건

- 원격 migration은 적용했지만 두 세션의 실제 동시 등록 경쟁과 담당 선생님 실계정 접근은 검증하지 못했다. 서버 잠금 순서·`VOLATILE` 조회는 SQL 계약 및 단일 세션 검증으로 확인했다.
- 공휴일 표시에는 한국천문연구원 특일정보 API 인증키가 필요하다. 키가 없는 환경에서는 재시도 가능한 오류를 표시하고 시간표 사용은 유지한다.
- 별도 온보딩 migration은 이번 적용 범위 밖이며 미적용이다. 이후 그 migration을 적용할 때 원격 이력 순서와 의존성을 다시 확인해야 한다.
- 원격 Security Advisor의 기존 `private.lesson_ticket_refund_quote` search path와 leaked password protection 경고는 이번 범위 밖이다. 이번 설정 테이블의 중복 허용 정책은 기능 오류가 아닌 성능 경고로 남겨 두며, 데이터가 늘어 조회 성능에 영향이 나타나면 정책을 명령별로 분리한다.
