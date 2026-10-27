# 카카오 인증과 학원별 직원 가입 구현 증거(2026-10-26)

## 발견 → 계획

- 기존 운영 기준은 원장 계정·학원·멤버십 각 1건이다. 기존 계정 ID를 유지한 수동 Kakao identity 연결이 필요하다.
- `academy_members`에 원장 직접 쓰기 권한과 첫 활성 학원 선택 코드가 있어 직원 승인 및 다중 학원 선택 정책을 우회하거나 잘못 적용할 수 있었다.
- 구현 범위는 사용자가 확정한 가입 계획에 따른 로컬 migration, 앱 코드, 테스트, 한국어 문서다. 원격 DB migration, Kakao 콘솔 설정, 앱 배포, 실제 카카오 인증은 별도 운영 단계다.
- 가독성: 로그인·가입·대기·원장 직원 관리를 분리한다. 예측 가능성: 신청 이력과 활성 멤버십을 분리하고 원자적 RPC로 부작용을 묶는다. 응집도: 인증 화면, 가입 API, 학원 선택, DB 권한 경계를 각 위치에 둔다. 결합도: 기존 운영 데이터 조회 키와 화면 변경 범위를 최소화한다. simplify 결과: 첫 학원 자동 선택과 이메일 일반 로그인 경로를 대체하고 중복 역할 표시를 합친다.

## Red → Green → Refactor

- 먼저 실패한 테스트: `auth-onboarding` 신규 모듈, `current-academy`의 마지막 학원 검증, Kakao callback 오류·redirect, 세션 게이트와 원장 승인 화면, migration 계약. 선생님 `member_id`를 INSERT에서 검사하지 않는 결함은 `academy-onboarding-contract.test.ts` 실패로 재현한 뒤 INSERT/UPDATE 트리거로 수정했다. 코드 재발급 확인 누락도 원장 화면 테스트 실패로 재현한 뒤 `AlertDialog`를 추가했다.
- `profiles.phone`, 비밀값 해시·초대·신청 이력, 부분 유일성 제약, RLS, 직접 쓰기 권한 회수, 학원 생성·신청·승인·역할·접근 RPC를 한 migration에 작성했다. 휴직·퇴사 트리거가 선생님 멤버십을 비활성화한다.
- Kakao OAuth callback, 신규/직원 온보딩, 원장 대기·직원·초대 화면, 학원 전환과 로그아웃, 기존 원장 제한 로그인·수동 연결 경로를 연결했다. 원장 목록은 공통 반응형 Table과 페이지 컨트롤을 쓴다.
- Refactor에서 상태 표시 함수를 분리하고 학원 역할 라벨을 한 곳으로 모았다. 학원 전환은 일부 query key만 지우는 방식에서 전체 query cache 삭제로 바꾸고, 비표준 query key까지 제거하는 테스트를 추가했다.

## Verify

- `pnpm test:run`: 188개 파일, 2,116개 테스트 통과.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: 통과했다.
- Playwright: 데스크톱·375px 모바일에서 가입 신청의 이름·휴대폰·신청 방법·승인 버튼과 승인 후 직원 목록을 확인했다. 기존 브라우저 시나리오 포함 29개 통과. 처음 샌드박스에서 `127.0.0.1:3107` 포트가 EPERM이었고, 자동 승인된 로컬 서버 실행으로 다시 수행해 통과했다.
- 전환용 두 경로는 요청 시점 환경변수를 읽도록 `connection()`을 호출한다. 마지막 빌드 출력에서 `/auth/legacy-link`와 `/auth/link-kakao`가 모두 동적 경로(`ƒ`)임을 확인했고, 플래그 on/off 4개 테스트가 통과했다.
- Supabase: 이 환경에는 Docker, `postgres`, `initdb`, `psql`이 없어 격리 로컬 DB에서 migration 실행 및 owner·desk·teacher·anonymous RLS/동시성 실행 검증을 수행하지 못했다. 계약 테스트는 SQL 문자열 검증이며 DB 실행 증거를 대체하지 않는다. 원격 migration도 적용하지 않았다. PostgreSQL 트리거 문법은 [공식 CREATE TRIGGER 문서](https://www.postgresql.org/docs/current/sql-createtrigger.html)와 대조했다.
- 실제 Kakao OAuth, 기존 원장 identity 연결, 원격 DB schema/history는 사용자의 콘솔 설정·원격 migration 별도 승인·배포가 끝난 뒤 검증해야 한다. 이메일 인증 종료 계획은 2026-10-27 사용자 요청에 따라 취소됐으며, 기존 이메일 로그인은 유지한다.
- 2026-10-26 읽기 전용 Supabase `list_migrations` 확인 결과 당시 `20261026053115_academy_onboarding`은 원격 이력에 없었다. 2026-10-27 적용 준비에서 파일 버전을 `20261027060000`으로 변경했다. 앱의 Supabase URL과 연결된 프로젝트 URL은 일치한다. 콘솔 Auth 설정과 배포 환경변수는 조회하지 못했으므로 설정 완료로 표시하지 않는다.

## Consolidate

- 가독성: OAuth 로그인, 온보딩, 원장 관리, 기존 계정 연결 화면을 분리하고 신청·초대 상태 이름을 함수로 명시했다.
- 예측 가능성: 승인·역할·접근 변경은 DB 트랜잭션 경계에서 검사하고 감사 이벤트를 기록한다. 재발급·초대 취소·접근 중지는 화면에서 확인을 받는다.
- 응집도: 인증 UI는 `src/features/auth`, 학원 선택은 `src/lib/api/current-academy.ts`, 가입 정책은 `src/domain/auth-onboarding.ts`, DB 제약은 단일 migration에 배치했다.
- 결합도: 기존 운영 query key 구조를 유지하고 학원 전환·로그아웃에서 cache 전체를 비워 이전 학원 데이터가 남지 않게 했다.
- simplify 결과: 첫 활성 학원을 암묵적으로 고르는 경로를 제거하고 공통 Table·ListPagination·역할 라벨을 재사용했다. 변경 파일 재독과 `git diff --check`를 수행했다.

## 남은 경계

- 실제 DB 실행 검증이 완료되기 전에는 역할별 RLS, 동시 승인 충돌, 휴직·퇴사 트리거 동작을 운영 준비 완료로 간주할 수 없다. `docs/engineering/kakao-auth-setup.md`와 migration runbook의 순서대로 확인한다.
- 2026-10-27 사용자가 이메일 필수 동의·동일 이메일 자동 연결 허용으로 정책을 변경했다. 이 문서의 구현 당시 이메일 미사용 전제는 더 이상 운영 설정 기준이 아니다. 이메일은 Supabase Auth 계정 생성·중복 확인·연결에만 쓰고 학원 권한에는 쓰지 않는다. 기존 원장과 카카오 계정의 이메일은 달라서 수동 연결이 필요하며, 같은 사용자 ID와 학원 멤버십 유지 여부를 운영에서 확인해야 한다.
- generated `src/lib/supabase/database.types.ts`는 원격에 새 migration이 아직 없어 갱신하지 않았다. API의 새 RPC 반환형은 좁은 별도 타입으로 다룬다. 원격 적용 후 타입을 재생성해야 한다.
- `academy_join_requests`·초대 이력 조회는 현재 클라이언트 페이지 분할이다. 장기적으로 대량 데이터가 쌓이면 서버 페이지네이션이 필요하다.
- `.env.local.example`에서 현재 로그인 화면에 사용되지 않는 이메일·비밀번호 사전 입력 예시를 제거하고 전환 기간용 두 플래그를 기록했다. 로컬 `.env.local`의 실제 비밀값은 읽어 출력하거나 수정하지 않았다.
