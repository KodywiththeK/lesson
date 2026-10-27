# 카카오 가입 적용 전 검토 (2026-10-27)

이 문서는 적용 전 상태의 기록이다. 이후 학원 가입·권한 migration 한 건을 적용한 결과는 `2026-10-27-academy-onboarding-migration.md`를 본다.

## 범위와 검증 상태

- 이번 검토는 읽기 전용이다. 원격 migration, 배포, 커밋은 수행하지 않았다.
- 원격 프로젝트 `zkzqmqtzzlgljkuctpbn`의 migration history에 `academy_onboarding`이 없다. `profiles.phone`도 아직 없고, 현재 학원·멤버십은 각 1건, 연결된 선생님 기록은 0건이다.
- `pnpm test:run`: 204개 파일, 2,151개 통과. `pnpm lint`, `pnpm typecheck`, `pnpm build`: 통과. `pnpm test:e2e`: 33개 통과. 브라우저 테스트는 데모·모의 API를 사용하므로 실제 Kakao OAuth와 RLS 검증을 대신하지 않는다.
- 로컬 PostgreSQL/Docker가 없어 migration SQL 실행과 역할별 RLS·동시성 테스트는 아직 수행하지 못했다. SQL 계약 테스트는 문자열 검사에 그친다.

## 적용 전 해결할 사항

1. **기존 원장 휴대폰 입력 누락:** 검토 당시 연결 화면에는 휴대폰 입력이 없었다. 최종 커밋 검토에서 국내 휴대폰 입력과 `profiles.phone` 저장 단계를 추가했고, 저장 실패 시 카카오 연결로 이동하지 않는 테스트를 추가했다. 결과는 `2026-10-27-kakao-auth-final-review.md`를 본다.
2. **Kakao 이메일 범위와 기존 원장 연결:** 사용자는 처음에 Kakao Developers의 `account_email`을 `사용 안 함 또는 권한 없음`이라고 답했으나, 이후 **필수 동의로 변경했다**고 확인했다. 이어 이메일 필수 수집과 Supabase의 동일 이메일 자동 identity 연결을 허용하기로 결정했다. 동의 목적은 `회원가입 및 로그인 시 기존 회원 계정의 중복 확인과 계정 연결`로 정리했다. 기존 원장 계정과 카카오 계정의 이메일은 **다르고**, 그 카카오 계정으로 아직 로그인 완료한 적이 없으므로 기존 계정 로그인 → `linkIdentity` 수동 연결이 선행돼야 한다. 이메일은 학원 권한·연락·마케팅에 사용하지 않는다. 실제 운영 OAuth 요청 범위, 이메일 반환, 기존 원장 연결 결과는 아직 검증해야 한다. [Supabase Kakao provider 구현](https://github.com/supabase/auth/blob/master/internal/api/provider/kakao.go), [Kakao 동의항목 설정](https://developers.kakao.com/docs/ko/kakaologin/prerequisite), [Supabase identity 연결](https://supabase.com/docs/guides/auth/auth-identity-linking)
3. **Migration 순서:** 원래 로컬 파일 버전 `20261026053115`보다 늦은 `20261026130428` migration이 이미 원격에 적용되어 있었다. 2026-10-27 적용 준비에서 미적용 파일을 `20261027060000_academy_onboarding.sql`로 이동해 원격 이력 뒤에 배치했다.
4. **DB 실행 검증:** owner·desk·teacher·anonymous의 RLS, 권한 직접 쓰기 우회, 초대 재사용·만료, 동시 승인, 휴직·퇴사 트리거를 격리 DB 또는 승인된 적용 후 원격에서 실행 검증해야 한다.
5. **필수 이메일 수집 고지:** 현재 저장소에는 개인정보 처리방침 페이지가 없다. 카카오 동의 목적과 일치하도록 이메일 항목·필수 조건·계정 중복 확인 및 연결 목적을 공개 처리방침에 반영해야 한다. [Kakao 동의항목 심사 기준](https://developers.kakao.com/docs/ko/kakaologin/prerequisite)

## 보완 후보

- 활성 학원이 있는 직원이 `/onboarding`에서 다른 학원에 신청하면 기존 학원으로 돌아가며, 대기·철회 상태는 해당 경로를 다시 열어야 볼 수 있다. 메인 화면에서 신청 현황으로 진입할 수 있도록 안내를 보강한다.
- 원장 신청 목록은 새 신청을 자동으로 새로고침하지 않는다. 새 신청 알림을 앱 목록으로만 제공하는 정책에 맞춰 명시적 새로고침 또는 재조회 주기를 검토한다.
- 선생님 후보가 모두 연결되어 있으면 인사 기록 등록 링크가 나타나지 않는다. 후보가 없는 경우에도 새 기록 등록으로 이동할 수 있어야 한다.
- `academy_onboarding`의 DB 테스트는 SQL 문자열 검사만 한다. 실제 예외 흐름 검증 전에는 권한 경계를 검증 완료로 표기하지 않는다.
- 신규 RPC 타입은 기존 원격 스키마에서 생성된 `database.types.ts`에 없다. 원격 적용 뒤 타입을 재생성하고 `unknown` 형변환을 줄인다.

## 품질 정리

- 가독성: 인증·온보딩·원장 관리는 파일로 분리됐지만 일부 화면의 긴 JSX와 `mutate` 공통 핸들러가 상태·오류 원인을 따라가기 어렵게 한다.
- 예측 가능성: DB RPC는 원자적이며 RLS를 우선한다. 다만 적용 전 DB 실행 검증이 없어 상태 전환 결과는 아직 확정할 수 없다.
- 응집도: 가입 정책은 migration과 auth feature에 집중돼 있다. 기존 원장의 프로필 완료 책임은 아직 빠져 있다.
- 결합도: 학원 전환 때 query cache를 비우고 기존 운영 화면의 query key는 유지한다. `/onboarding`과 세션 게이트의 흐름은 추가 시나리오 테스트가 필요하다.
- simplify 결과: 리뷰 중 불필요한 추상화보다는 누락된 프로필 단계와 실제 DB 검증을 우선 과제로 확인했다. 이번 검토에서는 제품 코드를 변경하지 않았다.

## 콘솔 확인 목록

- Kakao Developers: 로그인 사용 설정 ON, REST API 키의 Kakao Login Redirect URI가 `https://zkzqmqtzzlgljkuctpbn.supabase.co/auth/v1/callback`, Client Secret 활성, 동의항목 `profile_nickname`·`profile_image`·`account_email`의 실제 상태와 목적 확인. 로그아웃 리다이렉트 URI는 현재 기능에서 사용하지 않는다.
- Supabase: Kakao provider ON, Client ID에 REST API 키·Client Secret에 대응 secret, **이메일 없는 사용자 허용 OFF**, 수동 identity 연결, 전체 신규 사용자 가입 허용, Site URL 및 앱 `/auth/callback` 두 redirect URL 확인. 2026-10-27 추가 결정에 따라 Email provider는 계속 켜두고 이메일 신규 가입만 끈다.
- 배포 환경: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 확인. 기존 원장 전환 기간에만 `LEGACY_OWNER_LINK_ENABLED=1`, `NEXT_PUBLIC_LEGACY_OWNER_LINK_ENABLED=1` 사용. `NEXT_PUBLIC_PREFILL_LOGIN_EMAIL`·`NEXT_PUBLIC_PREFILL_LOGIN_PASSWORD`는 로컬 개발 전용이고 배포 환경에 두지 않는다. Kakao secret과 service-role/secret key, `SUPABASE_ACCESS_TOKEN`, `NEXT_PUBLIC_E2E_DEMO`도 앱 배포 환경에 두지 않는다.
