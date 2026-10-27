# 학원 가입·권한 migration 원격 적용 (2026-10-27)

## 발견·계획

- 사용자 요청에 따라 `lesson` 프로젝트(`zkzqmqtzzlgljkuctpbn`)의 학원 가입·권한 migration **한 건만** 적용한다. 대기 중인 악기 색상과 개인레슨 외상·서비스 회차권 migration은 제외한다.
- 적용 전 원격 마지막 이력은 `20261026130428_private_lesson_reservations_and_calendar_settings`였다. 가입 파일의 옛 버전 `20261026053115`는 그보다 앞섰으므로, 아직 미적용인 로컬 파일을 `20261027060000_academy_onboarding.sql`로 이동했다. 이 순서는 두 다른 대기 파일보다 앞이다.
- 적용 전 원격의 학원·원장 멤버십·프로필은 각 1건, 연결된 선생님 멤버십은 0건이었다. `profiles.phone`과 가입 테이블은 없었다. SQL에는 기존 운영 행 삭제가 없고 직접 멤버십 쓰기 권한 회수, 새 RPC·RLS·트리거가 있다.
- 가독성: 가입 이력과 활성 멤버십의 역할을 나눈 스키마를 그대로 적용한다. 예측 가능성: 파일과 이력 순서를 먼저 고정하고 SQL 재실행을 막는다. 응집도: 가입·권한 변경을 한 migration에 둔다. 결합도: 다른 두 대기 migration과 앱 배포를 분리한다. simplify 목표: 별도 보정 SQL 없이 원본 migration 한 번과 이력 정렬만 수행한다.

## Red → Green → Refactor

- 제품 기능의 선행 실패 테스트와 구현은 `2026-10-26-kakao-academy-onboarding.md`에 기록돼 있다. 이번 작업은 배포 단계이므로 새 제품 로직을 작성하지 않았다.
- `src/lib/supabase/academy-onboarding-contract.test.ts`를 포함한 관련 테스트 14개를 migration 파일명 변경 후 실행해 통과했다.
- Supabase MCP `apply_migration(name: academy_onboarding)`으로 로컬 SQL 전체를 원격에 적용했다. 성공 응답과 실제 스키마를 확인했다.
- MCP가 임시 버전 `20261027120024`로 기록해 로컬 파일명과 달랐다. 공식 CLI `migration repair --help`를 확인한 뒤 **이력만** `20261027060000` applied → `20261027120024` reverted 순서로 정렬했다. SQL을 다시 실행하지 않았다.

## Verify

- CLI `migration list`: `20261027060000` 로컬·원격 일치, 임시 버전 없음. `db push --dry-run`: 악기 색상과 개인레슨 외상·서비스 회차권 **두 건만** 대기. 실제 push는 하지 않았다.
- 실제 스키마: `profiles.phone`, 가입 신청·초대·코드 테이블, RLS, 공개 RPC 13개, 선생님 트리거 2개와 고유 인덱스 2개를 확인했다. 13개 RPC 모두 `SECURITY DEFINER`·고정 빈 `search_path`이며 authenticated만 실행할 수 있다.
- 권한: authenticated의 `academies` insert, `academy_members` insert/update, `academy_join_requests` insert는 직접 권한이 없었다. anon은 가입 신청 select와 RPC 실행 권한이 없었다. private 초대·코드 테이블 조회와 private 프로필 함수 실행은 두 역할 모두 거부됐다. 원장 JWT를 모사한 롤백 트랜잭션에서 신청·직원 목록을 읽었고, 비원장 JWT는 원장 목록 RPC에서 거부됐다. 원장 초대 발급·목록 조회도 롤백 트랜잭션에서 확인했으며 초대·감사 행은 남지 않았다.
- 운영 Auth 스모크: `.env.local`의 기존 원장 이메일·비밀번호를 출력하지 않고 `signInWithPassword`를 호출했다. `getUser`의 동일 사용자 ID, 활성 원장 멤버십과 기존 학원 조회가 모두 성공했다. 검증 세션만 `signOut({ scope: 'local' })`로 종료했다. 첫 시도는 로컬 Node 20의 WebSocket 미지원으로 클라이언트 생성 단계에서 멈췄고, `--experimental-websocket`으로 재실행해 통과했다. 카카오 로그인이나 identity 연결은 실행하지 않았다.
- 적용 전후 학원·멤버십·프로필은 각 1건으로 동일하다. 신청·초대·학원 코드 행은 각각 0건이다. 해당 학원의 초대 링크는 원장이 앱에서 발급할 수 있으며 학원 코드는 첫 발급이 필요하다.
- `pnpm vitest run src/lib/supabase/academy-onboarding-contract.test.ts src/domain/auth-onboarding.test.ts src/features/auth/academy-session-gate.test.tsx src/features/auth/owner-members-screen.test.tsx src/lib/supabase/oauth-callback.test.ts`: 5개 파일, 18개 통과. `git diff --check`도 통과했다. 코드 변경이 아니라 migration 적용과 파일명·문서 변경이므로 전체 린트·빌드는 재실행하지 않았다. 직전 구현 검증은 `2026-10-27-existing-email-login-retained.md`에 있다.

## Consolidate

- **가독성:** migration 이름을 실제 원격 순서로 맞추고 runbook에 실행 순서를 기록했다.
- **예측 가능성:** 원격 이력 정렬 후 dry-run으로 동일 SQL의 재적용 대상이 아님을 확인했다.
- **응집도:** 이번 적용에는 가입·권한 SQL만 포함했다. 색상·회차권 SQL은 별도 적용으로 남겼다.
- **결합도:** 기존 원장 데이터와 이메일 로그인 경로가 그대로 동작하는지 실제 Auth 세션으로 확인했다.
- **simplify 결과:** 임시 보정 migration이나 운영 데이터 수정 없이 원본 파일 한 번 적용과 공식 이력 정렬만 했다.

## 남은 위험과 운영 단계

- Supabase Security Advisor는 비공개 초대·코드 테이블의 RLS 정책 없음 2건을 알렸다. 이 테이블은 직접 접근 권한이 없고 RPC 내부에서만 사용하므로 의도된 상태다. 새 공개 `SECURITY DEFINER` RPC의 authenticated 실행 경고도 역할 검사형 RPC 설계에 따른다. 기존 `private.lesson_ticket_refund_quote`의 mutable search path와 Auth leaked-password protection 경고는 별도로 남는다.
- 실제 다른 학원의 owner·desk·teacher 사용자, 초대 7일 만료·재사용, 동시 승인, 휴직·퇴사 자동 중지의 운영 JWT/동시성 테스트는 수행하지 못했다. 로컬 격리 Supabase DB도 없었다. 롤백 역할 테스트와 카탈로그 확인은 이 범위를 모두 대체하지 않는다.
- 기존 원장 `profiles.phone`은 컬럼만 추가돼 비어 있다. 앱의 기존 원장 프로필 완료 입력 단계는 아직 없다. 카카오 콘솔 설정, 카카오 수동 identity 연결, 앱 배포, 개인정보 처리방침은 별도 단계로 남는다.
- 사용자가 승인한 범위 밖의 두 migration은 원격에 적용하지 않았다. 코드 커밋·push도 수행하지 않았다.
