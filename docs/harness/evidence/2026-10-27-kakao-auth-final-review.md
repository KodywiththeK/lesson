# 카카오 가입·기존 원장 전환 커밋 전 최종 검토

## 발견 → 계획

- 원격의 기존 원장 사용자 ID에는 Kakao identity가 아직 없다. 다른 사용자 ID의 Kakao identity가 1건 있으나, 사용자는 그 계정이 원장에게 연결할 카카오 계정과 다르다고 확인했다. 실제 원장 연결·카카오 재로그인·이메일 로그인 정리는 아직 실행하지 않았다.
- 기존 원장 연결 화면에는 확정 계획의 연락용 휴대폰 저장이 빠져 있었다. 신청자가 반려 후 `승인 상태 새로고침`을 눌러도 신청 이력은 다시 읽지 않았다. 다른 활성 학원이 있는 사용자는 `/onboarding`에서 새로고침만 해도 기존 학원으로 이동했다.
- 원격 `profiles.phone` 컬럼은 적용됐지만 생성된 TypeScript 타입에는 빠져 있었다. Supabase 타입 생성 도구의 현재 `profiles` 정의에서 `phone: string | null`과 선택적 Insert·Update 필드를 확인했다.
- **가독성:** 원장 연결 폼의 입력·저장 순서를 눈에 보이게 나눈다. **예측 가능성:** 휴대폰 저장 실패와 신청 갱신을 화면 상태에 정확히 반영한다. **응집도:** 기존 원장 입력은 auth feature, 신청 상태는 onboarding feature와 page에 둔다. **결합도:** 학원 운영 데이터와 이미 적용된 DB 함수는 변경하지 않는다. **simplify 결과:** 중복 상태나 임시 경로를 늘리지 않고 기존 프로필 RLS와 신청 query key를 사용한다.

## Red → Green → Refactor

- 기존 원장 휴대폰 저장·실패 테스트 2건을 먼저 작성해 휴대폰 필드 누락으로 실패함을 확인했다. 국내 번호 형식 오류 테스트를 추가하고, 원장 멤버십 확인 뒤 `profiles.phone` 저장 성공 시에만 카카오 연결 화면으로 이동하게 했다.
- 반려 신청 새로고침 테스트를 먼저 작성해 기존 `대기` 표시가 갱신되지 않는 실패를 확인했다. 신청 이력 query를 다시 읽은 뒤 멤버십 확인 콜백을 실행하게 했다.
- 다른 활성 학원이 있는 사용자의 `/onboarding` 테스트를 먼저 작성해 새로고침 때 원래 학원으로 이동하는 실패를 확인했다. 새 학원을 실제 생성한 경우에만 학원을 선택·이동하고, 그 외에는 상태를 확인할 수 있게 현재 화면에 남긴다. 현재 학원으로 돌아가는 링크를 제공한다.
- 원장 연결 폼의 긴 단일 JSX 반환을 나눴고, 테스트의 프로필 업데이트 mock도 분리했다. 생성 타입 파일에는 원격 정의와 일치하는 `profiles.phone` 필드만 반영했다.

## Verify

- Red: `legacy-owner-sign-in.test.tsx` 2건, `onboarding-screen.test.tsx` 1건, `onboarding/page.test.tsx` 1건이 의도한 누락 때문에 실패했다.
- Green: 영향 범위 테스트 3개 파일, 5건 통과. 최종 `pnpm test:run`은 212개 파일·2,189건 통과했다.
- 최종 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `git diff --check` 통과. 타입 갱신 전 `pnpm typecheck`는 `profiles.phone` 누락으로 실패했고 갱신 후 통과했다. 데모 `NEXT_PUBLIC_E2E_DEMO=1 pnpm build --webpack` 통과. `academy-onboarding.spec.ts` Chromium 1건 통과(데스크톱·375px 모바일 동일 정보·승인 작업). 샌드박스 로컬 포트 차단으로 첫 브라우저 실행이 실패했으나, 허용된 로컬 포트 실행으로 검증했다.
- 원격 SQL은 이번 최종 검토에서 변경하지 않았다. 앞선 가입·권한 및 기존 비밀번호 폐기 함수 적용, 실제 스키마·history 결과는 각각 `2026-10-27-academy-onboarding-migration.md`, `2026-10-27-kakao-legacy-retirement-and-onboarding-logout.md`에 기록했다. 원장·다른 카카오 계정의 identity 건수만 읽기 전용으로 확인했고 연락처·비밀값은 출력하지 않았다.

## Consolidate

- **가독성:** 원장 입력과 전화번호의 목적을 화면과 운영 절차에 명확히 썼다.
- **예측 가능성:** 프로필 저장 실패 시 연결 화면으로 이동하지 않고, 신청 상태 새로고침은 실제 신청 목록을 재조회한다.
- **응집도:** 기존 원장 연락처 완성, 가입 신청 상태, 다중 학원 진입 경로를 각 feature 근처에서 수정했다.
- **결합도:** 기존 학원·사용자 ID와 운영 테이블은 변경하지 않았고, 원격 migration도 추가 적용하지 않았다.
- **simplify 결과:** `profiles.phone`에 별도 RPC를 만들지 않고 이미 적용된 본인 프로필 RLS를 사용했다. Claude Code `/simplify` 호출은 CLI가 로그인되어 있지 않아 실행되지 않았다. 이후 변경 diff를 직접 읽고 같은 다섯 기준으로 정리했다.

## 남은 운영 검증

- 앱 배포 뒤 실제 원장 계정에 Kakao identity를 연결하고 **같은 사용자 ID** 및 기존 학원·원장 멤버십을 확인해야 한다. 로그아웃 후 일반 카카오 로그인으로 기존 데이터를 열어 본 다음 임시 정리 버튼을 사용한다.
- 실제 카카오 인증, 이메일 identity 해제 후 기본 이메일 전환, owner·desk·teacher·anonymous 역할별 DB 실행 검증은 아직 수행하지 못했다. 로컬 Docker daemon에 연결할 수 없어 격리 DB 테스트도 대기 중이다.
- 공개 운영 전 카카오 필수 이메일 수집 목적과 개인정보 처리방침을 일치시키고, 앱 배포 환경의 전환 플래그와 redirect URL을 `docs/engineering/kakao-auth-setup.md`대로 확인해야 한다.
