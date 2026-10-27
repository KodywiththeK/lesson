# 카카오 전환 후 기존 이메일 로그인 정리·가입 화면 로그아웃

## 발견 → 계획

- 원격 데모 학원 `aaaaaaaa-...`의 생성자와 활성 원장 멤버십은 같은 사용자 ID `11111111-...`를 가리킨다. 확인 시 Kakao identity는 아직 없고 공개된 시드 비밀번호가 설정돼 있었다. 원격 조회는 비밀값을 출력하지 않았다.
- 최신 사용자 결정은 카카오 연결과 일반 카카오 재로그인 검증 **이후** 기존 이메일 identity·비밀번호 해시를 폐기하고, 그다음 Email provider와 이메일 로그인 코드를 제거하는 것이다. 이후 사용자가 정리 migration은 미리 적용해 달라고 요청해 **함수만 원격에 설치**했다. 실제 계정 정리는 진행하지 않았다.
- 가입 화면 로그아웃은 사용자 답변에 따라 **앱의 Supabase 세션만** 종료한다. 카카오 사이트 세션을 종료하지 않는다.
- 가독성: 인증 상태별 화면과 인증 정보 제거 adapter를 분리한다. 예측 가능성: 비밀번호 해시 제거 → 이메일 identity 해제 → 완료 확인 순서와 부분 실패 재시도를 명시한다. 응집도: 인증 전환 UI는 `src/features/auth`, Auth DB 작업은 전용 migration과 API adapter에 둔다. 결합도: 기존 학원 ID·멤버십·운영 화면은 변경하지 않는다. simplify 결과는 검증 뒤 재점검한다.

## Red → Green → Refactor

- 가입 화면 로그아웃과 카카오 노란색 버튼 테스트를 먼저 추가했다. 버튼 누락·기본 파란색으로 2건 실패했다. `AcademySessionGate`의 기존 로그아웃 경로를 가입 화면에도 연결하고 카카오 버튼 색을 적용해 통과했다.
- 기존 원장 비밀번호 폐기 migration 계약 테스트는 파일이 없어 실패했다. `supabase migration new`로 파일을 만들고, 고정된 데모 원장 ID·학원 ID, 활성 owner 멤버십, Kakao identity, OAuth 세션을 검증하는 RPC를 추가했다. 비밀번호 해시 `NULL` 처리와 감사 기록을 같은 트랜잭션에 두었다. `public`·`anon` 실행 권한을 회수했다.
- API adapter 테스트는 파일이 없어 실패했다. 비밀번호 해시를 먼저 지우고 Supabase `unlinkIdentity(email)`을 호출하며, 완료 상태를 DB의 해시 상태와 Auth identities로 다시 확인하도록 구현했다. 해시 제거 또는 identity 해제 실패 때 완료로 표시하지 않는다.
- 임시 화면 컴포넌트 테스트는 파일이 없어 실패했다. 원장 확인, 파괴적 작업 확인 대화상자, 완료 안내를 구현했다. 기존 원장 전환 플래그가 꺼지면 경로를 404로 막는다.
- 기본 이메일이 옛 데모 주소에 남아 있는 예외 테스트가 실패했고, 추가 확인 상태를 도입해 잘못된 완료 표시를 막았다. identity 해제 이메일 충돌 오류는 한국어로 안내한다.

## Verify

- `pnpm vitest run` 영향 범위: 48개 통과(마지막 재검증).
- `pnpm test:run`: 209개 파일, 2,184개 통과(마지막 변경 뒤 전체 재검증).
- `pnpm lint`: 통과. `pnpm typecheck`: 통과. `pnpm build`: 통과(마지막 변경 뒤 재검증).
- `git diff --check`: 통과.
- UI 증거: React Testing Library에서 가입 화면 로그아웃·학원 캐시 제거, 카카오 버튼 색, 임시 화면의 권한 상태·확인 대화상자·완료 안내를 검증했다. 실제 OAuth 브라우저 검증은 아직 하지 않았다.
- Supabase 증거: 적용 전 원격에서 기존 원장·학원·멤버십 연결 정상, Kakao identity 0건, 비밀번호 해시 존재, 새 함수 부재를 확인했다. MCP `apply_migration`으로 `retire_legacy_owner_password`를 적용했고 원격 history는 `20261027140448`이다. `pg_get_functiondef`로 원격 함수 정의를 확인했다. 함수 2개가 `SECURITY DEFINER`로 설치됐고 `anon` 실행 불가·`authenticated` 실행 가능이며, 실제 함수 정의에 고정 원장 ID·활성 owner 멤버십·Kakao identity·OAuth JWT 검사와 비밀번호 해시 제거가 포함돼 있다. 적용 후에도 원장·학원 연결 정상, Kakao identity 0건, 비밀번호 해시 존재, 정리 감사 이벤트 0건이다. 파일명 변경 뒤 영향 테스트 18개 통과, `git diff --check` 통과. 로컬 DB 실행 검증은 Docker daemon 연결 실패로 수행할 수 없었다.

## Consolidate

- **가독성:** 정리 작업을 별도 화면과 API adapter로 분리하고 상태를 `ineligible`·`needs-kakao`·`ready`·`needs-review`·`complete`로 드러냈다.
- **예측 가능성:** 이메일 identity 해제 전에 비밀번호 해시를 제거한다. 중간 실패 시 재시도 가능하며 DB 상태를 다시 확인해 완료 여부를 결정한다.
- **응집도:** 임시 UI, API adapter, 고정 데모 원장 대상 RPC를 각 책임에 맞게 배치했다.
- **결합도:** 가입 화면은 기존 세션 로그아웃 함수를 재사용한다. 운영 데이터 테이블과 기존 원장 사용자 ID는 건드리지 않았다.
- **simplify 결과:** `Account` 타입의 복잡한 `Exclude` 조합을 명시적 상태 union으로 바꿨다. 카카오 버튼의 브랜드 색상은 두 인증 화면에만 적용하고 공용 버튼 전체는 변경하지 않았다.

원격 Security Advisor는 새 함수 2개가 `authenticated`에게 공개된 `SECURITY DEFINER` 함수라며 `authenticated_security_definer_function_executable` 경고를 냈다. 클라이언트에서 호출해야 하는 전용 RPC라 실행 권한은 의도적으로 열었다. 함수 내부에서 고정 원장 ID, 활성 멤버십, 연결된 Kakao identity, OAuth JWT를 확인하고 `anon` 실행 권한은 회수했다. 관련 [Supabase advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## 남은 위험·운영 경계

- 현재 원장에게는 Kakao identity가 없어 정리 버튼을 사용할 수 없다. 먼저 기존 계정에서 카카오를 연결하고, 로그아웃 후 일반 카카오 로그인으로 같은 학원을 확인해야 한다.
- `20261027140448_retire_legacy_owner_password.sql`은 원격에 적용했고 로컬 파일명을 원격 history와 맞췄다. 다른 대기 migration 두 건(악기 색상, 개인레슨 외상·서비스 회차권)은 적용하지 않았다.
- 실제 Auth email identity 해제 후 기본 이메일 승격과 RPC의 OAuth `amr` 검사는 운영 전 격리 DB 및 실제 카카오 로그인으로 검증해야 한다. Docker가 재가동되면 owner·other user·email session·OAuth session별 DB 실행 테스트를 수행한다.
- 정리 후 기존 이메일 로그인 실패, 비밀번호 해시 `NULL`, email identity 0건, kakao identity 1건, 옛 기본 이메일 제거, 동일 원장·학원·데이터를 확인한다. 그다음 Email provider와 앱 이메일 로그인 코드를 제거한다. `supabase/seed.sql`을 원격에 재적용하면 데모 비밀번호가 다시 설정될 수 있다.
