# 카카오 인증 운영 설정과 전환 순서

이 문서는 이번 가입 코드의 운영 반영 절차다. 키·secret·초대 원문은 문서, 채팅, 저장소에 남기지 않는다. 학원 가입·권한 migration은 2026-10-27 사용자 요청으로 적용했다.

## 1. 카카오·Supabase 콘솔 설정

1. 사용자가 Kakao Developers에 앱을 만들고 **카카오 로그인 → 일반 → 사용 설정**을 켠다. `앱 → 플랫폼 키 → REST API 키`의 키를 Supabase Kakao provider의 Client ID로, 같은 REST API 키 설정의 활성 Client Secret을 Client Secret으로 **Supabase 콘솔에만** 입력한다. JavaScript 키는 이 앱의 Supabase OAuth 흐름에 사용하지 않는다.
2. Kakao Login Redirect URI에는 Supabase Authentication → Sign In / Providers → Kakao에 표시된 Callback URL을 등록한다. 현재 연결된 프로젝트 기준 주소는 `https://zkzqmqtzzlgljkuctpbn.supabase.co/auth/v1/callback`이다. 이 칸에 앱의 `/auth/callback` 주소를 넣지 않는다. 로컬 **Supabase Auth**를 별도로 사용할 때만 `http://localhost:54321/auth/v1/callback`도 추가한다.
3. 2026-10-27 사용자 결정에 따라 Kakao Developers의 `account_email`은 **필수 동의**로 설정한다. 동의 목적은 `회원가입 및 로그인 시 기존 회원 계정의 중복 확인과 계정 연결`이다. Supabase Auth가 이 이메일을 계정 생성·중복 확인·동일 이메일 identity 자동 연결에 사용한다. 앱의 학원 역할 판정, 연락, 마케팅에는 사용하지 않는다. 카카오에 제출·연결한 개인정보 처리방침에도 이메일 항목, 필수 수집 조건, 동일한 사용 목적을 기재한다. 현재 저장소에는 개인정보 처리방침 페이지가 없으므로 공개 운영 전 별도 마련이 필요하다. 현재 앱은 카카오 닉네임·프로필 사진을 화면에 사용하지 않으므로 실사용 기능 없이 표시 목적을 적지 않는다. 공개된 Supabase Kakao provider 구현은 `profile_nickname`, `profile_image`도 기본 OAuth 범위로 요청한다. 해당 항목은 실제 요청·동의 설정과 화면 사용 목적을 맞춰 별도로 확인한다. 이름·휴대폰은 앱에서 직접 입력받고 휴대폰 본인 확인을 뜻하지 않는다.
4. Supabase Authentication → General Configuration의 **Allow manual linking**과 전체 **Allow new users to sign up**을 켠다. **전환이 끝날 때까지 Sign In / Providers → Email provider를 켜두고 그 안의 이메일 신규 가입 허용만 끈다.** 기존 원장이 카카오 연결과 새 카카오 로그인을 확인한 후 이메일 인증 정보를 제거하고, 그다음 Email provider를 끈다. Kakao provider의 **Allow users without an email**은 필수 이메일 정책에 맞춰 끈다. 앱에는 `/auth/callback`에서 PKCE 코드를 교환하는 경로가 있다. Supabase URL Configuration의 Site URL을 현재 공식 앱 주소 `https://lesson-pi-ten.vercel.app`로 설정하고 Redirect URLs에 `https://lesson-pi-ten.vercel.app/auth/callback`, `https://lesson-pi-ten.vercel.app/auth/callback?next=%2Fauth%2Flink-kakao`를 허용한다. 로컬 앱 검증 시 같은 두 경로의 `http://localhost:3000` 주소도 허용한다. 실제 배포 도메인이 다르면 앱 주소를 그 도메인으로 바꾼다.
5. 앱 배포 환경에는 `NEXT_PUBLIC_SUPABASE_URL=https://zkzqmqtzzlgljkuctpbn.supabase.co`와 이 프로젝트의 **publishable key**를 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 등록한다. 전환 기간에만 `LEGACY_OWNER_LINK_ENABLED=1`과 `NEXT_PUBLIC_LEGACY_OWNER_LINK_ENABLED=1`을 함께 설정하고 새 빌드로 배포한다. 전환 완료 뒤 둘 다 제거하고 이메일 로그인 코드를 제거한 새 빌드를 배포한다. 로컬 개발에서만 `NEXT_PUBLIC_PREFILL_LOGIN_EMAIL`·`NEXT_PUBLIC_PREFILL_LOGIN_PASSWORD`로 기존 계정 입력을 자동 채울 수 있다. 이 두 값은 공개 변수이므로 배포 환경에 등록하지 않는다. Kakao REST API 키·Client Secret과 `SUPABASE_ACCESS_TOKEN`은 앱 환경변수로 등록하지 않는다. 공휴일 검증에 필요한 `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 환경변수로만 등록하며 브라우저에 노출하지 않는다. `NEXT_PUBLIC_E2E_DEMO`는 운영에서 설정하지 않는다.

공식 기준: [Supabase 카카오 로그인](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao), [Supabase Auth 카카오 provider 구현](https://github.com/supabase/auth/blob/master/internal/api/provider/kakao.go), [Kakao KOE205 설명](https://developers.kakao.com/docs/ko/kakaologin/trouble-shooting), [identity 연결](https://supabase.com/docs/guides/auth/auth-identity-linking), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 2. DB와 앱 반영

1. `20261027060000_academy_onboarding.sql`은 2026-10-27 사용자 요청으로 원격에 적용했고 schema, RLS/grant/trigger, migration history를 확인했다. 상세 결과는 `docs/harness/evidence/2026-10-27-academy-onboarding-migration.md`를 본다. 악기 색상과 개인레슨 외상·서비스 회차권 migration은 아직 대기 중이다.
2. 앱을 배포한다. 이 마이그레이션 전에 앱을 배포하면 새 RPC가 없어 가입 화면이 실패한다.
3. `NEXT_PUBLIC_PREFILL_LOGIN_EMAIL`은 로컬 개발 화면의 자동 입력값일 뿐 계정 ID나 데이터 연결 키가 아니다. 기존 원장 계정과 연결할 카카오 계정의 이메일은 **서로 다르다**. 사용자는 원격에 이미 존재하는 다른 Kakao identity 1건은 원장에게 연결할 계정과 다르다고 확인했다. 원장에게 연결할 카카오 계정으로는 아직 로그인하지 않았다. 따라서 일반 카카오 로그인 버튼을 먼저 누르지 말고, `/auth/legacy-link`에서 **기존 원장 계정**으로 이메일·비밀번호 및 연락용 국내 휴대폰 번호를 입력한다. 원장 멤버십과 프로필의 휴대폰 저장을 확인한 뒤 `/auth/link-kakao`에서 `linkIdentity({ provider: "kakao" })`를 실행한다. 이 작업은 기존 `auth.users.id`에 Kakao identity를 추가하며 학원 데이터를 복사하거나 소유자 ID를 바꾸지 않는다. 같은 사용자 ID와 Kakao identity가 확인되면 학원·멤버십 ID가 유지됐는지 운영 DB에서 대조한다. ID가 다르면 전환을 멈추고 별도 확인한다. 휴대폰으로 계정을 연결하지 않는다.
4. 기존 원장이 로그아웃 뒤 **일반 카카오 로그인으로 동일한 사용자 ID와 학원·원장 멤버십·기존 데이터**에 접근되는지 확인한다. 앱의 로그아웃은 Supabase 세션만 종료하며 카카오 사이트 세션은 종료하지 않는다.
5. `20261027140448_retire_legacy_owner_password.sql`은 2026-10-27 사용자 요청으로 **원격에 미리 적용했다**. 적용만으로 비밀번호나 identity가 삭제되지는 않는다. 원장이 카카오를 연결하고 일반 카카오 로그인으로 기존 학원을 확인한 뒤 계정 메뉴 → **기존 이메일 로그인 정리**를 연다. 이 기능은 고정 데모 원장 ID, 활성 owner 멤버십, 연결된 Kakao identity, OAuth 로그인 세션을 DB에서 확인한 뒤 비밀번호 해시를 `NULL`로 만들고 감사 기록을 남긴다. 그다음 앱이 Supabase Auth API로 이메일 identity를 해제한다. 중간에 실패하면 원장 계정과 Kakao identity를 유지하고 화면에서 다시 시도할 수 있다.
6. 정리 후 원격 DB에서 비밀번호 해시 `NULL`, 이메일 identity 0건, Kakao identity 1건, 기본 이메일이 옛 데모 주소가 아님, 사용자 ID·학원·멤버십 불변을 읽기 전용으로 확인한다. 기존 이메일 로그인이 실패하고 카카오로 새로 로그인하면 같은 학원이 열리는지 확인한다. 이전 세션은 전체 로그아웃으로 갱신 토큰을 폐기하며 이미 발급된 access token은 만료 시각까지 유효할 수 있다. 그다음 Email provider를 끄고 앱의 일반 이메일 로그인·전환 화면·자동 입력 환경변수를 제거한 빌드를 배포한다. 카카오 가입을 위해 전체 **Allow new users to sign up은 유지**한다. 원격에 `seed.sql`을 재적용하면 데모 비밀번호가 다시 설정될 수 있으므로 운영 시드는 실행하지 않는다. 카카오 계정 분실은 운영자 신원 확인을 거쳐 별도 수동 복구한다.

## 3. 운영 확인

- 신규 owner가 학원과 원장 멤버십을 한 번에 만들고, 직원이 초대와 코드로 각각 대기 신청하는지 확인한다.
- owner가 desk/teacher를 승인할 때 인사 기록 연결 조건과 다른 학원 차단이 지켜지는지 확인한다. 휴직·퇴사 시 teacher 접근이 바로 중지되고, 재직 복귀 후 자동으로 열리지 않는지 확인한다.
- 직접 `academy_members` 쓰기, 공동 원장 부여, 재사용·만료·취소된 초대, 회전 전 학원 코드를 거부하는지 확인한다.
- 원격 검증 전까지 카카오 OAuth 실제 동작과 RLS 실행 결과는 검증 완료로 간주하지 않는다.
