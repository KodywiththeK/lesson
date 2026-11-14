# 플랫폼 관리자 앱 구축 및 운영 계획

작성 기준: 2026-11-01, 인계 보강: 2026-11-14. 이 문서는 플랫폼 관리자 앱의 **구현 인계 계획과 현재 작업 기록**이다. 다른 컴퓨터·새 세션에서 `git pull` 후 이 문서만 읽고 바로 이어서 작업할 수 있도록 쓴다. 완료 표시가 없는 항목은 실제 구현이나 운영 적용으로 간주하지 않는다.

---

## 0. 새 세션 시작 가이드 (먼저 읽기)

### 0.1 지금 어디까지 왔나

- 1단계(workspace)는 초안이 커밋되어 있다. 2단계(관리자 인증)는 부품(로그인 화면, TOTP 컴포넌트, 판정 함수)만 있고, DB 등록부, RPC, 서버 게이트, 흐름 연결이 없다.
- **다음에 할 일: 10.1(1단계 마무리) → 10.2(2단계 관리자 인증)를 순서대로 수행한다.** 각 절의 "작업 순서" 체크리스트 첫 항목부터 시작한다.
- 관리자 앱은 아직 안전하게 사용할 수 있는 완성품이 아니다. 원격 DB 변경, 관리자 권한 부여, 배포는 하지 않았다.

### 0.2 확정된 사용자 결정 (2026-11-14)

| 결정 | 내용 |
| --- | --- |
| 다음 작업 범위 | 1단계 마무리와 2단계 관리자 인증까지. 대시보드는 빈 틀까지만이고 3단계 이후는 범위 밖이다. |
| 로컬 DB | 사용자가 Docker Desktop을 실행하고 `pnpm dlx supabase`로 **로컬 스택만** 사용한다. Supabase CLI를 devDependency로 추가하지 않는다. |
| 원격·운영 | 원격 migration, 원격 Auth 설정, 관리자 권한 부여, 배포는 별도 명시 요청이 있을 때만 수행한다. 커밋과 push도 요청이 있을 때만 한다. |

### 0.3 환경 준비

```bash
git pull
pnpm install
docker info --format '{{.ServerVersion}}'
pnpm dlx supabase --version
```

- Node·pnpm: 루트 `package.json`의 `packageManager`(pnpm 10.26.2)를 따른다. 작성 시점 Node는 v20.13.1이었다.
- Docker: `docker info`가 소켓 오류를 내면 Docker Desktop을 실행하고 다시 확인한다. 데몬이 꺼진 상태로 로컬 DB 검증을 진행하지 않는다.
- 로컬 Supabase 시작과 값 확인(원격 `link`나 `db push`는 실행하지 않는다):

```bash
pnpm dlx supabase start
```

```bash
pnpm dlx supabase status
```

- 환경변수:
  - 루트 `.env.local`: 서비스 앱용이다. 기존 값을 그대로 쓴다.
  - `apps/platform-admin/.env.local`: `apps/platform-admin/.env.local.example`을 복사해 만든다. 로컬 검증 때는 `supabase status`의 API URL과 publishable 또는 anon 키를 넣는다. 값은 문서나 채팅에 남기지 않는다.
  - `SUPABASE_SECRET_KEY`: 5단계(회원 삭제) 전까지 필요 없다. 넣지 않는다.

### 0.4 명령

| 목적 | 명령 |
| --- | --- |
| 관리자 앱 개발 서버 (포트 3001) | `pnpm --filter @madimadi/platform-admin dev` |
| 관리자 앱 빌드 | `pnpm --filter @madimadi/platform-admin build` |
| 관리자 앱 typecheck | `pnpm --filter @madimadi/platform-admin typecheck` |
| 관리자 앱 단위·컴포넌트 테스트만 | `pnpm vitest run --project platform-admin` |
| 저장소 전체 검증 | `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build` |
| 로컬 DB 초기화와 전체 migration 재적용 | `pnpm dlx supabase db reset` |

`pnpm test:run`은 루트 `vitest.config.ts`의 `platform-admin` 프로젝트를 함께 실행한다. lint는 루트 `eslint .`이 관리자 앱 소스까지 검사한다(`apps/*/.next/**`는 무시).

### 0.5 작업 규칙 요약

- 모든 단계는 `발견 → 계획 → Red → Green → Refactor → Verify → Consolidate → Evidence` 흐름을 따른다(`AGENTS.md`, `docs/harness/agent-loop.md`).
- 정책, 권한, UX, 스키마 영향, 파괴적 작업은 추측하지 않고 사용자에게 질문한다. 미결정 목록은 4절과 각 단계의 "질문할 결정"에 있다.
- 단계를 끝낼 때마다 2절 상태 표, 이 문서의 체크리스트, `docs/harness/evidence/`의 evidence를 갱신한다.
- 커밋 전에는 `/simplify`를 실행하고 evidence를 작성한다(`CLAUDE.md`).

---

## 1. 목표와 구조

운영자 한 명이 별도 관리자 앱에서 전체 사용자와 학원을 관리하고, 필요할 때 특정 학원의 업무를 대신 처리한다. 두 앱은 같은 저장소와 Supabase 프로젝트를 사용하지만, 서로 다른 앱으로 빌드·배포하고 환경변수와 접근 경계를 구분한다.

기존 학원 앱을 `apps` 아래로 옮기는 것은 **필수가 아니다**. 현재 pnpm workspace는 저장소 루트 앱과 `apps/platform-admin`을 함께 관리한다. 기존 배포 경로, import, 테스트, 설정에 불필요한 영향을 주지 않도록 루트 위치를 유지한다. 추후 `apps/service`로 이동하려면 별도 범위와 검증을 잡는다.

학원 대행을 시작하고 사용하는 곳은 **관리자 앱**이다. 관리자는 관리자 앱에서 학원을 고르고 사유를 입력한 뒤, 같은 관리자 앱의 대행 화면에서 기존 학원 화면과 동일한 업무 화면을 사용한다. 기존 화면의 공통 컴포넌트와 업무 로직은 두 앱이 재사용한다. 기존 서비스 앱에 관리자 전용 메뉴를 넣거나 원장으로 로그인한 척하지 않는다.

```text
저장소
├─ src/                          기존 서비스 앱, 기존 URL과 배포 유지
├─ proxy.ts                      서비스 앱 세션 갱신
├─ apps/platform-admin/          별도 관리자 앱, 별도 URL과 배포 (포트 3001)
│  └─ src/{app,features,lib}     관리자 전용 라우트·기능. "@/..."는 루트 src를 가리킨다
├─ supabase/                     공유 DB migration과 로컬 검증
├─ docs/                         공통 정책·구현·운영 문서
├─ pnpm-workspace.yaml           packages: apps/platform-admin
└─ pnpm-lock.yaml                공통 lockfile

관리자 카카오 + TOTP → 관리자 앱 → 학원과 사유 선택
  → 관리자 앱의 대행 화면 → 기존 업무 UI/로직 재사용
  → 실제 관리자와 대행 범위를 서버·DB가 확인 → 공유 Supabase
```

관리자 앱의 `tsconfig.json`은 `@/*`를 `../../src/*`로 매핑한다. 따라서 `@/components/ui/...`, `@/lib/supabase/...` 같은 서비스 공용 코드를 그대로 import한다. 관리자 전용 코드는 상대 경로(`../features/...`)로 참조한다. 스타일은 `apps/platform-admin/src/app/globals.css`가 서비스 `globals.css`를 import하고, `@source`로 루트 `src`를 스캔한다.

---

## 2. 현재 상태 (2026-11-14 커밋 기준)

### 2.1 파일별 상태

| 파일 | 역할 | 상태 |
| --- | --- | --- |
| `pnpm-workspace.yaml` | workspace에 `apps/platform-admin` 추가 | 완료 |
| `pnpm-lock.yaml` | 관리자 앱 의존성 반영 | 완료 |
| `vitest.config.ts` | `platform-admin` 테스트 프로젝트(jsdom, 서비스 `src/test/setup.ts` 재사용) | 완료 |
| `eslint.config.mjs` | `apps/*/.next/**` 무시 추가(관리자 빌드 산출물 5,610건 오탐 해결) | 완료 |
| `apps/platform-admin/package.json` | `dev`/`build`/`start`(3001), `typecheck` | 완료 |
| `apps/platform-admin/next.config.ts` | `X-Robots-Tag: noindex, nofollow` 헤더 | 완료(보안 헤더는 10.2 보완) |
| `apps/platform-admin/tsconfig.json` | 루트 tsconfig 상속, `@/*` → 루트 `src` | 완료 |
| `apps/platform-admin/.env.local.example` | 공개 URL·키 예시, 서버 비밀키는 주석 | 완료 |
| `src/app/layout.tsx` | `lang="ko"`, robots noindex | 완료 |
| `src/app/page.tsx` | 로그인 화면만 렌더 | **재작성 필요**: 상태별 분기가 없다 |
| `src/app/auth/callback/route.ts` | 서비스 callback 재사용(`export { GET }`) | 사용 가능. 실패 시 `/auth/error`로 보내지만 관리자 앱에는 이 페이지가 **없다** |
| `src/features/auth/admin-sign-in.tsx` | 카카오 OAuth 시작 | 동작 초안. 임의 색 `bg-[#FEE500]` 정리 필요 |
| `src/features/auth/admin-mfa-enrollment.tsx` | TOTP 등록(QR, 확인, 취소) | 초안. 흐름에 **연결 안 됨** |
| `src/features/auth/admin-mfa-challenge.tsx` | TOTP 확인(factor 선택, 6자리) | 초안. 흐름에 **연결 안 됨** |
| `src/features/auth/mfa-error.ts` | `mfa_verification_failed` 친절 문구 | 완료 |
| `src/lib/authorize-admin.ts` | 서버 판정 함수 | **수정 필요**: 판정 순서 문제(2.2-1). 호출하는 RPC가 DB에 없다 |
| 테스트 3개 파일(`*.test.ts(x)`) | 판정·로그인·MFA 컴포넌트 | 통과 |

### 2.2 조사에서 찾은 보완점 (2단계에서 처리)

1. **판정 순서 결함:** `authorizePlatformAdmin`은 aal을 등록 여부보다 먼저 판정한다. 그 결과 미등록 원장 카카오 계정도 `mfa-required`를 받아 TOTP 등록 화면에 들어갈 수 있다. 미등록 계정에 factor가 생기지 않도록 등록 확인을 aal 판정 앞에 둔다(10.2 설계).
2. 관리자 앱에 `/auth/error` 페이지가 없다. 서비스 페이지 문구는 "관리자에게 문의"라서 관리자 앱에 맞지 않는다.
3. 관리자 앱에 세션 갱신 proxy가 없다. 토큰 만료 후 서버 컴포넌트가 refresh된 세션을 받지 못한다.
4. `supabase/config.toml`의 `[auth.mfa.totp]`가 `enroll_enabled = false`, `verify_enabled = false`라서 로컬에서 TOTP를 쓸 수 없다.
5. 관리자 대시보드, 로그아웃, 권한 없음 화면이 없다.
6. 카카오 버튼 색이 서비스 2곳(`src/features/auth/academy-session-gate.tsx`, `src/features/auth/link-owner-kakao.tsx`)과 관리자 1곳에 임의값으로 중복되어 있다. 디자인 시스템 규칙(`docs/engineering/design-system.md`)에 맞게 토큰이나 버튼 variant로 묶을지 검토한다. 서비스 테스트(`academy-session-gate.test.tsx`)가 클래스 문자열을 단언하고 있어 함께 정리한다.
7. 루트 `tsconfig.json`의 include `**/*.ts`가 `apps/`까지 포함한다. 현재 루트 typecheck는 통과하지만, 관리자 앱 고유 설정이 늘어나 충돌하면 루트 `exclude`에 `apps`를 추가하고 관리자 앱 자체 typecheck로 분리한다.
8. 로컬 Supabase CLI는 없고(사용자 결정에 따라 `pnpm dlx`), 작성 시점에 Docker 데몬은 꺼져 있었다.
9. DB 수준 검증 수단이 없다. 지금 contract 테스트는 SQL 문자열 검사뿐이다. 2단계부터 로컬 DB에 SQL 시나리오를 실행해 확인한다(10.2 검증).

### 2.3 이번 커밋 시점 검증 결과 (2026-11-14 실제 실행)

| 명령 | 결과 |
| --- | --- |
| `pnpm lint` | 통과. eslint ignore 추가 전에는 `apps/platform-admin/.next` 생성물로 285 errors였다. |
| `pnpm typecheck` | 통과 |
| `pnpm --filter @madimadi/platform-admin typecheck` | 통과 |
| `pnpm test:run` | 248 files, 2459 tests 통과(관리자 프로젝트 포함) |
| `pnpm --filter @madimadi/platform-admin build` | 통과. 라우트는 `/`, `/_not-found`, `/auth/callback`. |
| 로컬 Supabase, 브라우저, 실제 OAuth | 미실행 |

이번 커밋은 다른 컴퓨터로 옮기기 위한 **초안 인계 커밋**이라 `/simplify`와 evidence를 생략했다. 초안 코드는 2단계에서 판정 순서, 라우트, 버튼 스타일이 재작성될 예정이므로, 2단계 완료 커밋에서 simplify와 evidence(`docs/harness/evidence/<날짜>-platform-admin-auth.md`)를 수행한다.

---

## 3. 확정된 제품 정책

- 관리자는 운영자 한 명이며 기존 학원 원장 계정과 **별도의 카카오 계정**을 사용한다. TOTP 2차 인증을 요구한다.
- 사용자·학원·소속을 관리하며 영구 회원 탈퇴를 지원한다. 특정 회원의 카카오 연결만 해제하는 기능은 제공하지 않는다.
- 관리자가 학원과 사유를 지정해 소유자의 승인 없이 대행을 시작한다. 한 대행 세션은 30분이다.
- 대행 범위에는 기존 학원 업무 전체와 수납·급여, 주민등록번호 등 민감 인사정보가 포함된다.
- 대행 중 원장 화면과 **특정 직원의 화면**을 선택할 수 있다. 직원 화면에서는 선택된 직원과 같은 학원 내 접근 범위를 적용한다. 원장 화면으로 돌아가면 원장 범위의 대행이 가능하다.
- 대행자와 대행 사유를 포함한 관리자 전용 이력은 관리자에게만 표시한다. 학원 사용자가 보던 일반 업무 변경 이력은 유지한다.
- 학원 생성자인 원장을 영구 삭제하면, 그 원장이 만든 학원과 그 학원의 원생·직원 기록, 수업·급여·수납 등 업무 데이터를 삭제한다. 다른 직원의 로그인 계정은 유지한다.
- 직원을 영구 삭제하면 직원 계정과 직원 기록은 정리한다. 학원의 공유 업무 기록, 과거 급여·수업, 당시 선생님 이름은 보존한다.
- 한 계정이 A학원 원장이고 B학원 직원이면, A학원은 삭제하고 B학원 업무 기록은 보존한다. 다른 학원 소속과 데이터에도 같은 원칙을 적용한다.
- 관리자 MFA 복구는 복구 코드와 Supabase 콘솔을 모두 준비한다. 현재 설치된 SDK에는 복구 코드 기능이 없으므로 라이브러리 갱신 후 실제 지원 여부를 검증한다. 확인 전까지 복구가 가능하다고 안내하지 않는다.

## 4. 구현 전 추가로 확정해야 할 항목

다음은 임의로 결정하지 않고, 삭제 작업에도 반영하지 않는다. 해당 단계에 착수할 때 선택지를 만들어 사용자에게 묻는다.

| # | 항목 | 막는 단계 | 질문 시점과 준비물 |
| --- | --- | --- | --- |
| 1 | 과거 선생님 이름: 이름 스냅샷이 없는 수업 기록 경로가 있다. 개명 후에는 당시 이름을 복원할 수 없다. 현재 이름 표시, 미확인 표시, 삭제 차단 중 무엇으로 할지 정한다. | 5 | 최신 실제 스키마와 데이터를 조사한 뒤 묻는다. |
| 2 | 학원 삭제 후 관리자 전용 감사 기록의 보존 기간과 익명화 범위. 주민등록번호 등 민감 원문과 토큰은 남기지 않는다. | 3(감사 테이블 설계), 5 | 감사 테이블 초안과 함께 묻는다. |
| 3 | Storage 소유 파일과 그 밖의 외부 연계 데이터의 삭제·보존 범위 | 5 | 실제 사용 여부와 소유 관계를 조사한 뒤 묻는다. |
| 4 | 관리자 앱 배포처와 도메인, 운영·미리보기 환경의 OAuth 허용 URL | 6(운영 적용) | 기존 배포 환경을 확인한 뒤 묻는다. |
| 5 | 복구 코드: SDK와 Auth 조합에서 기능 제공과 운영 가능 여부. 불가하면 대안을 다시 묻는다. 예비 인증 앱은 복구 코드와 동등하지 않다. | 2 후속(10.2.7) | SDK 실험 결과와 함께 묻는다. |
| 6 | 영구 삭제의 상세 확인 방식, 대행 중 변경된 직원 상태의 처리 등 제품 UX와 운영 정책 | 3, 5 | 화면 초안과 함께 묻는다. |
| 7 | 관리자 로그인 세션의 유휴 만료 여부와 시간. 대행 30분과는 별개다. | 2 후속, 3 | 2단계 완료 후 묻는다. |
| 8 | 관리자 감사 기록 시작 시점: 2단계 로그인·MFA 성공·실패 이벤트도 남길지 | 3 | 감사 테이블 설계 때 묻는다. |

---

## 5. 인증과 관리자 권한 (원칙)

### 5.1 최초 관리자 등록

1. 별도 관리자 카카오 계정을 준비하고 관리자 앱 인증 경로로 로그인한다. 기존 원장과 이메일이 같으면 Supabase가 자동 연결할 수 있으므로, 별도 사용자 ID가 생성됐는지 먼저 확인한다. 실제 이메일, 비밀번호, 토큰은 문서나 채팅에 기록하지 않는다.
2. 사용자가 Supabase 콘솔에서 계정의 사용자 ID를 확인한다. 최초 등록은 승인된 운영 절차로, 서버가 관리하는 관리자 등록부에 그 ID를 넣는다(10.2의 콘솔 SQL). 사용자 편집 metadata, 이메일 문자열, 프런트 환경변수로 권한을 부여하지 않는다.
3. 제한된 등록·TOTP 설정 상태와 완전 활성 상태를 분리한다. 미등록 사용자나 MFA 전 세션은 관리자 화면과 API를 사용할 수 없어야 한다. 최초 등록용 예외가 일반 로그인 통로가 되지 않도록 종료 조건을 테스트한다.
4. TOTP 등록과 검증을 완료한 뒤 관리자 전용 권한과 `aal2`를 확인한다. 관리자와 원장 사용자 ID가 별개인지 다시 확인한다.

관리자 등록·회수용 DB 변경과 실제 운영 권한 부여는 로컬 검증 이후 각각 명시적 승인과 운영 절차를 거친다. 서비스 역할 키는 서버 전용이며 브라우저, 공개 환경변수, 로그에 넣지 않는다.

### 5.2 매 요청의 검증

민감 화면, 서버 API, DB 작업은 각각 실제 인증된 사용자, 서명 검증된 claims, 관리자 등록 상태, MFA 수준, 세션 상태를 검증한다. 필요한 작업은 `session_id`의 유효성과 대행 세션의 소유·만료를 DB 시간 기준으로 확인한다. 프런트가 보낸 관리자 여부, 사용자 ID, 역할, URL, 숨겨진 메뉴는 권한 근거가 아니다. 권한 회수, 로그아웃, MFA 미완료, 세션 만료 시에는 기존 화면이 열려 있어도 새 작업을 서버·DB에서 거부한다.

관리자 계정에 이메일과 비밀번호를 추가하거나 기존 원장 이메일 로그인을 제거하는 작업은 이 계획의 필수 단계가 아니다.

### 5.3 TOTP 복구

SDK 갱신을 별도 변경으로 검토하고, Supabase Auth의 실제 복구 코드 기능, 배포 설정, SSR 호환성, `aal2` 적용을 실험한다. 코드 생성과 일회 표시, 안전한 보관 안내, 사용·재사용 거부·폐기·재발급을 검증하고, 원문을 로그에 남기지 않는다. 또한 Supabase 콘솔 관리자 접근 복구와 앱 사용자의 MFA 복구는 다른 절차임을 명시하고, 콘솔 권한 복구와 앱 MFA 재설정 절차를 각각 실제로 검증한다. 새 의존성이나 실험 기능의 채택은 검증 결과와 사용자 승인에 따른다.

## 6. 대행 세션과 기존 화면 재사용 (원칙)

### 6.1 사용자 흐름

1. 관리자 로그인과 TOTP 완료 → 사용자/학원 검색 → 학원 상세
2. 학원을 명시하고 대행 사유를 입력 → 시작 → 서버가 30분 만료 시각을 부여
3. 관리자 앱 안에서 원장 화면을 열거나, 해당 학원의 활성 직원을 골라 그 직원 화면으로 전환
4. 직원 화면에서는 해당 직원의 역할과 본인 데이터 범위를 모두 적용한다. 원장 화면은 원장 대행 범위를 적용한다.
5. 종료하거나 시간이 지나면 작업을 거부하고 관리자 화면으로 복귀한다. 남은 시간, 현재 학원, 현재 화면 대상을 명확히 표시한다.

화면 대상을 바꿔도 실제 로그인 사용자는 계속 관리자다. 다른 사람의 비밀번호나 토큰을 받지 않고, 그 직원의 JWT를 만들지 않는다. 학원·직원 선택 값은 신뢰하지 않으며, 서버에서 해당 학원의 유효 멤버십과 역할을 실제로 확인한다. 어떤 직원이 비활성화·삭제되거나 역할이 바뀌면, 다음 작업부터 기존 권한을 계속 쓰지 못하게 한다.

### 6.2 재사용 구현

- `src/app`에 묶여 있는 페이지를 조사하고, 실제 업무 화면을 재사용 가능한 feature 컴포넌트로 분리한다. 서비스 라우트와 관리자 대행 라우트는 같은 컴포넌트를 호출하는 얇은 어댑터로 둔다.
- 관리자 앱 안의 `/support/...` 경로를 후보로 사용한다. 경로 구조는 기존 라우트 조사와 UX 확정 후 결정한다. 두 도메인 사이에 인증 쿠키를 넘기거나 기존 원장 세션을 덮어쓰지 않는다.
- 기존 절대 링크, 리다이렉트, API 경로와 `/api/holidays` 등 서버 기능을 목록화하고, 현재 앱의 기본 경로를 인식하도록 정리한다. 두 앱에서 환경변수와 서버 기능이 실제로 필요한지 각각 확인한다.
- 원장·데스크·선생님의 메뉴와 개인별 조회 경로를 빠짐없이 조사한다. 특히 `auth.uid()`에 의존하는 본인 수업·급여 조회는 실제 행위자인 관리자와 검증된 직원 화면 대상을 분리해야 한다. 직원 화면을 선택했다고 관리자 ID를 직원 ID로 바꾸지 않는다.
- 학원·대상·역할·세션별로 query cache 경계를 두고, 전환·만료·종료·로그아웃 때 기존 데이터를 비우고 화면을 다시 마운트한다. 캐시를 지우는 것이 DB 권한 검사를 대신하지는 않는다.
- 기존 서비스 앱의 원장·직원 권한과 사용자 경험은 회귀 테스트한다. 관리자 대행 UI는 관리자 앱에 둔다. 공유 업무 컴포넌트와 DB 권한 코드는 필요한 만큼 양쪽을 지원한다.

## 7. DB 권한과 감사 설계 (원칙)

실제 테이블·함수명은 구현 전에 전체 스키마를 조사한 뒤 확정한다. 아래는 책임과 검증 기준이다. 2단계에서 확정한 이름은 10.2에 있다.

- **서버 관리 관리자 등록부:** 사용자 ID, 활성 상태, 등록·회수 시각을 둔다. 일반 사용자는 직접 쓰거나 자신을 등록할 수 없다.
- **대행 세션:** 실제 관리자 ID와 인증 세션, 학원, 사유, 시작·만료·종료 상태, 선택한 화면 대상을 둔다. 생성·대상 변경·종료는 검증된 RPC나 서버 경계에서 처리하고 DB 시간 기준으로 확인한다.
- **관리자 전용 감사:** 행위자, 대상 학원·화면, 작업 종류, 대상 식별자, 시각, 결과와 사유를 업무 이벤트와 구분해 기록한다. 개인정보 원문, 비밀번호, 토큰, 불필요한 요청 본문은 기록하지 않는다. 사유 입력에 민감정보를 쓰지 않도록 안내한다.
- **일반 업무 이력:** 기존 원장·직원이 볼 수 있는 출결·수업 등의 이력은 유지한다. 관리자 정체와 대행 사유는 노출하지 않는다. 업무 기록과 관리자 전용 기록을 분리하고, 행위자 표시·metadata·조인·`SECURITY DEFINER` RPC까지 모든 노출 경로를 점검한다.
- **권한 함수 점검:** `private.has_academy_role`, `private.is_active_academy_member`, 멤버십 직접 조회, 도메인 RPC, 직접 테이블 접근을 목록화한다. 모든 정책에 '관리자면 허용'을 단순히 추가하지 않는다. 각 기능이 유효한 대행 세션, 현재 학원, 선택된 직원 범위를 반영하는지 점검한다.
- **서비스 역할 키:** RLS를 우회하므로 일반 업무 대행을 위해 브라우저에 주거나 무분별하게 사용하지 않는다. 서버 전용 관리 API에도 별도의 인증·인가와 감사가 필요하다.
- **역할 조합 검증:** `anonymous`, 일반 사용자, 다른 학원 원장·직원, 관리자 `aal1`/`aal2`, 세션 만료·회수 등 실제 역할 조합을 격리 DB에서 확인한다. 소유자에게는 관리자 전용 이력이 직접 쿼리와 모든 이력 RPC에서 보이지 않아야 한다.

## 8. 영구 회원 삭제 (원칙)

### 8.1 삭제 전 분석과 미리보기

실제 최신 DB에서 `auth.users`, `profiles`, `academy_members`, `teachers`, 학원과 업무 테이블의 외래키·삭제 동작·트리거·Storage 소유 관계를 전수 조사한다. 삭제 화면에는 다음을 보여 준다.

- 대상 사용자와 소속
- 삭제될 원장 학원과 해당 학원의 데이터 범위
- 보존될 다른 학원과 업무 기록
- 다른 직원 로그인 계정의 보존 여부

범위를 확인할 수 없으면 삭제를 막는다. 상세 확인 UX는 사용자와 확정한다.

현 구조에서 `salary_settlements.teacher_id`는 선생님 행이 삭제되면 급여 기록을 연쇄 삭제할 수 있다. 일부 수업 기록은 선생님 이름을 조인해 표시하므로 행이 없어지면 이름이 사라질 수 있다. 따라서 단순 Auth 삭제나 선생님 행 삭제로 기능을 완성하지 않는다. 급여·수업의 과거 이름과 기록을 보존하는 스키마·조회 변경, 기존 데이터 보완, 관계별 삭제 처리를 설계하고 테스트한다. 과거 이름을 복구할 수 없는 경우는 4절 1번 결정을 따른다.

### 8.2 안전한 실행

1. 영향 범위를 다시 확인하고, 대상 계정과 연관 변경을 적절히 잠가 미리보기 이후의 변경을 감지한다.
2. 재시도 가능한 삭제 작업 상태를 기록하고, 필요한 범위에서 사용자의 신규 업무 접근을 차단한다.
3. 보존해야 할 B학원 업무 기록과 과거 이름을 확보한 뒤, DB에서 관계별 정리를 원자적으로 수행할 단위를 구분한다. A학원 삭제가 다른 직원 Auth 계정 삭제로 전파되지 않음을 검사한다.
4. 서버 전용 Supabase Auth Admin API로 계정을 삭제한다. DB 트랜잭션과 외부 Auth API 전체가 하나의 원자적 트랜잭션이라고 가정하지 않는다.
5. 부분 실패는 작업 상태와 감사에 남긴다. 중복 실행해도 안전하게 재개하거나, 운영자에게 복구 절차를 안내한다. 성공 여부는 Auth와 DB 양쪽에서 검증한다.
6. 이미 발급된 access token의 잔여 유효 시간과, Storage 소유 객체로 인한 삭제 실패를 검증한다. 사용자의 실제 접근 범위를 DB에서 차단하는 방안을 검증하고, 즉시 무효화된다고 단정하지 않는다.

삭제 기능의 구현·테스트와 실제 운영 계정 삭제는 별도 행위다. 운영 삭제는 이 계획만으로 실행하지 않는다.

## 9. 기능 추가 때 관리자 앱을 함께 유지하는 규칙

같은 저장소에 있다는 것만으로 관리자 앱의 기능 반영이나 재배포가 자동으로 보장되지는 않는다. 6단계에서 다음을 저장소의 실제 규칙과 CI로 만든다.

1. `AGENTS.md`와 `docs/harness/agent-loop.md`에 서비스 변경 시 관리자 영향 검토를 필수 단계로 추가한다.
2. `docs/harness/verification-matrix.md`, `docs/engineering/permissions.md`, `docs/product/traceability-matrix.md`, `docs/product/acceptance-scenarios.md`, 운영 runbook을 함께 갱신한다.
3. 새 화면·업무 액션·RPC마다 다음을 기록한다. 대행 제외나 제한은 사용자가 정책을 결정한다.
   - 서비스 역할
   - 관리자 대행 가능 여부와 원장·직원 대상별 범위
   - 대행 이력과 기존 이력의 노출
   - 개인정보
   - 해당 앱 라우트와 테스트
4. 공통 라우트·기능 목록과 관리자 대행 연결 정보를 관리하는 단일 기준을 둔다. 누락된 화면이나 분류가 있으면 실패하는 `pnpm check:admin-parity` 등의 검사와 CI를 구현한다. 미등록 기능은 기본적으로 대행을 허용하지 않는다.
5. 자동화는 숨은 버튼·RPC·정책 누락을 모두 증명할 수 없다. 변경 diff에 대한 사람·에이전트 검토와, 실제 역할별 DB·브라우저 테스트를 함께 요구한다.
6. 서비스 앱과 관리자 앱 각각 lint·typecheck·test·build를 실행한다. 배포 시 두 앱이 동일한 공유 기능과 DB 버전에 호환되는지 확인하고, 한쪽만 배포해도 되는지 명시적으로 판단한다.

예를 들어 서비스 앱에 급여 내보내기를 새로 추가하면 다음을 확인한다. 관리자 원장 대행에서 쓸 수 있는가, 특정 선생님 대행 시 본인 범위로 제한되는가, 민감정보·다운로드 감사와 이력 노출은 어떤가, 두 앱의 경로·테스트·배포가 함께 반영됐는가.

---

## 10. 단계별 상세 작업

각 단계는 `발견 → 계획 → Red → Green → Refactor → Verify → Consolidate → Evidence` 순서로 수행한다. 단계 요약은 아래와 같다.

| 단계 | 내용 | 상태 | 막는 결정 |
| --- | --- | --- | --- |
| 1. workspace | 설정 정리, 양 앱 독립 실행·빌드 | 초안 커밋, 마무리 필요 | 없음 |
| 2. 관리자 인증 | 등록부, RPC, proxy, 게이트, TOTP 흐름, 빈 대시보드 | 부품만 있음 | 없음(복구 코드는 4-5) |
| 3. 목록과 대행 세션 | 사용자·학원 검색, 상세, 대행 시작·종료·만료, 대상 전환, 감사 | 미착수 | 4-2, 4-6, 4-7, 4-8 |
| 4. 업무 대행 | 공통 화면 추출, 라우트 적응, 역할·개인 범위 DB 권한 | 미착수 | 3단계 완료 |
| 5. 사용자 삭제 | 영향 분석, 이름 보존, 관계 정리, 재시도, Auth 삭제 | 미착수 | 4-1, 4-2, 4-3, 4-6 |
| 6. 품질·운영 | parity 규칙·CI, 문서, 배포 runbook, 운영 적용 준비 | 미착수 | 4-4 |

0단계(전수 조사)는 단계마다 착수 전 "발견"으로 나눠 수행한다. 각 단계의 "착수 전 조사"가 그 범위다.

### 10.1 1단계 — workspace 마무리

**목표:** 서비스 앱 회귀 없이 두 앱이 각각 실행·빌드·검증된다.

**작업 순서**

- [x] `pnpm-workspace.yaml`, lockfile, 관리자 앱 package·설정 작성
- [x] vitest `platform-admin` 프로젝트 추가
- [x] `eslint.config.mjs`에 `apps/*/.next/**` ignore 추가
- [ ] 관리자 앱 dev 서버가 3001에서 뜨고 서비스 dev(3000)와 동시에 실행되는지 확인
- [ ] `docs/harness/commands.md`에 0.4의 관리자 앱 명령을 추가하고, `docs/harness/verification-matrix.md`에 관리자 앱 검증 행을 추가
- [ ] 루트 tsconfig가 `apps/`를 포함하는 문제(2.2-7) 판단: 현재 통과하므로 유지하고, 충돌이 생길 때만 분리한다는 결정을 이 문서에 기록
- [ ] 관리자 앱 `next-env.d.ts`가 typegen 때 `.next/dev/types`로 바뀌는 현상은 서비스와 같은 생성물 동작이다. 커밋 시 생성물 변경은 stage하지 않는다.

**검증:** `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build`, `pnpm --filter @madimadi/platform-admin build`

**완료 기준:** 위 명령이 모두 통과한다. 서비스 `pnpm test:e2e`는 workspace 변경이 서비스 빌드에 영향을 주지 않았음을 확인하는 용도로 1회 실행한다.

### 10.2 2단계 — 관리자 인증 (바로 착수할 단계)

**목표:** 등록된 관리자만 카카오 로그인과 TOTP를 거쳐 빈 대시보드에 들어갈 수 있다. 미등록 계정, `aal1`, 위조·회수·로그아웃된 세션은 화면과 DB에서 모두 거부된다.

#### 10.2.1 판정 순서 (설계 확정)

`apps/platform-admin/src/lib/authorize-admin.ts`를 다음 순서로 바꾼다.

1. `auth.getUser()` 실패(`AuthSessionMissingError`)이거나 사용자가 없음 → `sign-in-required`. 다른 오류는 `unavailable`.
2. `auth.getClaims()`의 `sub`가 사용자 ID와 다르거나 `session_id`가 없음 → `forbidden`.
3. `rpc("platform_admin_is_registered")`가 false → `forbidden`. aal1에서도 호출할 수 있다. 미등록 계정은 MFA 화면에 들어가지 못한다.
4. `claims.aal !== "aal2"` → `mfa-required`.
5. `rpc("platform_admin_is_authorized")`가 false → `forbidden`. 이 RPC는 DB에서 aal2, 활성 등록, 세션 존재를 다시 검사한다.
6. 통과 → `{ ok: true, userId }`.

RPC 오류는 모두 `unavailable`로 처리한다. 등록 여부 RPC는 호출자 본인의 상태만 알려 주므로 다른 사용자 정보가 노출되지 않는다. 등록(enroll)이 필요한지 확인(challenge)이 필요한지는 판정 함수가 아니라 MFA 화면이 `auth.mfa.getAuthenticatorAssuranceLevel()`의 `nextLevel`로 나눈다. 판정 함수의 책임을 작게 유지하기 위해서다.

#### 10.2.2 DB migration (로컬에만 적용)

파일: `supabase/migrations/<UTC timestamp>_platform_admin_registry.sql`. 타임스탬프는 기존 마지막 파일 `20261114000600` 이후로 한다.

```sql
-- 설계 스케치. 기존 migration의 security definer 패턴을 확인하고 맞춘다.
create table private.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
revoke all on table private.platform_admins from public, anon, authenticated;

create function private.is_platform_admin() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from private.platform_admins
                       where user_id = (select auth.uid()) and revoked_at is null) $$;

create function public.platform_admin_is_registered() returns boolean ...
  -- private.is_platform_admin() 결과만 반환한다. aal은 따지지 않는다.

create function public.platform_admin_is_authorized() returns boolean ...
  -- private.is_platform_admin()
  -- and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  -- and exists (select 1 from auth.sessions
  --             where id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  --               and user_id = auth.uid())

-- 모든 함수: revoke all on function ... from public;
--          grant execute on function public.* to authenticated;
```

- `private` 스키마는 API로 노출되지 않는다(`supabase/config.toml` `schemas = ["public", "graphql_public"]`). 등록 RPC는 **만들지 않는다**.
- `auth.sessions`에 `not_after`(세션 만료 시각) 컬럼이 있다면 만료 조건도 함께 검사한다. 로컬 스키마에서 컬럼을 확인한 뒤 결정한다.
- `private.is_platform_admin()`은 3단계 대행 RPC에서 재사용한다.
- `supabase/config.toml`의 `[auth.mfa.totp]`를 `enroll_enabled = true`, `verify_enabled = true`로 바꾼다. 로컬 설정이므로 원격 콘솔 설정은 11절 운영 항목으로 둔다.
- `src/lib/supabase/database.types.ts`에 두 RPC 타입을 추가한다. 로컬에서 `pnpm dlx supabase gen types typescript --local`을 실행해 실제 타입과 대조한다. 생성 결과 전체로 덮어쓰기 전에 diff를 확인한다.

운영 등록·회수 절차(콘솔 SQL Editor에서 실행하며, 값은 문서와 채팅에 남기지 않는다):

```sql
insert into private.platform_admins (user_id) values ('<관리자 사용자 ID>');
update private.platform_admins set revoked_at = now() where user_id = '<관리자 사용자 ID>';
```

#### 10.2.3 관리자 앱 라우트와 컴포넌트

| 경로·파일 | 설계 |
| --- | --- |
| `apps/platform-admin/src/proxy.ts` | Next 16 규칙상 `app`과 같은 레벨인 `src` 안에 둔다(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). 루트 `proxy.ts`처럼 `@/lib/supabase/proxy`의 `updateSession`과 같은 matcher를 재사용한다. |
| `src/app/page.tsx` (server) | `createSupabaseServerClient()`로 `authorizePlatformAdmin`을 호출해 분기한다. `sign-in-required` → `AdminSignIn`. `forbidden` → 권한 없음 안내와 로그아웃. `mfa-required` → `AdminMfaGate`. `unavailable` → 다시 시도 안내. `ok` → `/dashboard`로 redirect. 분기는 판정 결과를 화면으로 바꾸는 작은 함수로 빼서 테스트한다. |
| `src/features/auth/admin-mfa-gate.tsx` (client) | `getAuthenticatorAssuranceLevel()`의 `nextLevel === "aal2"`이면 `AdminMfaChallenge`, 아니면 `AdminMfaEnrollment`를 보여 준다. 성공 콜백은 `router.refresh()`로 서버 판정을 다시 받는다. 로그아웃 버튼을 포함한다. |
| `src/features/auth/admin-sign-out.tsx` (client) | `auth.signOut()`을 호출한 뒤 `/`로 보낸다. 실패하면 `toUserMessage`로 안내한다. |
| `src/app/dashboard/layout.tsx` (server) | 매 요청마다 `authorizePlatformAdmin`을 호출하고, 실패하면 `/`로 redirect한다. 서버 데이터 접근이 있는 하위 라우트는 이 layout에만 기대지 말고 각 서버 함수나 RPC에서 다시 검증한다(5.2). |
| `src/app/dashboard/page.tsx` | 제목, 로그인한 관리자 표시, 로그아웃만 둔다. 3단계 예정 안내는 `EmptyState`로 표시한다. |
| `src/app/auth/error/page.tsx` | 관리자 앱용 얇은 페이지다. "로그인을 완료하지 못했습니다"와 다시 로그인 링크를 두며, 서비스의 "관리자에게 문의" 문구는 쓰지 않는다. |
| `src/app/not-found.tsx` | 관리자 앱 404. 첫 화면으로 가는 링크를 둔다. |
| `admin-sign-in.tsx` 등 | `SectionCard`와 토큰을 우선 쓴다. 카카오 버튼 색은 2.2-6을 정리해 서비스와 공유하는 variant나 토큰으로 맞춘다. |
| `next.config.ts` | `X-Frame-Options: DENY`(또는 CSP `frame-ancestors 'none'`), `Referrer-Policy: no-referrer`를 추가한다. 전체 CSP는 6단계에서 다룬다. |

#### 10.2.4 먼저 작성할 실패 테스트 (Red)

1. `apps/platform-admin/src/lib/authorize-admin.test.ts`:
   - 미등록이면 aal1이어도 `forbidden`을 받고 aal 판정 전에 멈춘다.
   - 등록됐고 aal1이면 `mfa-required`를 받으며 `is_authorized`를 호출하지 않는다.
   - aal2인데 `is_authorized`가 false이면 `forbidden`을 받는다.
   - 각 RPC 오류는 `unavailable`이 된다.
   - 기존 테스트의 RPC 호출 순서 기대값을 새 순서에 맞게 고친다.
2. `src/lib/supabase/platform-admin-registry-contract.test.ts`(기존 contract 패턴): migration 파일이 하나인지 확인하고 다음을 검사한다.
   - `private.platform_admins` 테이블과 revoke
   - 세 함수의 `security definer`와 `set search_path = ''`
   - `aal2`, `auth.sessions`, `session_id`, `revoked_at is null` 조건
   - authenticated에만 grant
   - `insert`·`register` RPC가 없는지
   - 클래스 문자열이 아니라 SQL 의미를 검사한다.
3. `admin-mfa-gate.test.tsx`: `nextLevel`이 aal2이면 확인 화면, aal1이면 등록 화면을 보여 준다. 성공하면 `refresh`를 호출하고, AAL 조회 오류는 안내 문구로 보여 준다.
4. 페이지 분기 함수 테스트: 판정 결과 5종이 각각 맞는 화면(heading이나 button 이름)과 redirect로 이어지는지 확인한다.
5. `admin-sign-out.test.tsx`, `/auth/error`와 not-found 렌더 테스트(role과 이름 기준).

#### 10.2.5 로컬 DB 검증 시나리오

`pnpm dlx supabase db reset`으로 migration 전체를 다시 적용한 뒤, 아래 시나리오를 SQL로 실행한다. 스크립트는 scratchpad 또는 `supabase/tests/`에 둔다. `supabase/tests/`에 두면 이후 단계에서 재사용할 수 있으므로, pgTAP(`pnpm dlx supabase test db`) 도입 여부를 검토하고 결정을 기록한다.

트랜잭션마다 `set local role authenticated;`와 `set local request.jwt.claims = '{"sub":"…","aal":"…","session_id":"…","role":"authenticated"}';`로 역할을 바꾼다. 테스트 사용자와 세션 행은 같은 스크립트에서 `auth.users`와 `auth.sessions`에 만든다.

| # | 조건 | 기대 |
| --- | --- | --- |
| 1 | anon | 두 RPC 실행 권한 거부, `private.platform_admins` 접근 거부 |
| 2 | 미등록 authenticated, aal2, 유효 세션 | registered=false, authorized=false |
| 3 | 등록, aal1, 유효 세션 | registered=true, authorized=false |
| 4 | 등록, aal2, 유효 세션 | registered=true, authorized=true |
| 5 | 등록, aal2, `auth.sessions`에 없는 session_id | authorized=false |
| 6 | 회수(`revoked_at` 설정) | 둘 다 false |
| 7 | authenticated의 `private.platform_admins` insert·update 시도 | 거부 |
| 8 | (선택) 세션 행 삭제(로그아웃) 후 같은 claims | authorized=false |

#### 10.2.6 브라우저 검증

- 관리자 앱을 로컬 Supabase에 연결하고 `pnpm --filter @madimadi/platform-admin build` 후 `start`로 실행한다. 데스크톱과 모바일(375px) 폭에서 다음을 확인한다.
  - 비로그인 시 `/`가 로그인 화면이다.
  - `/dashboard`는 `/`로 redirect된다.
  - `/auth/error`와 404가 표시된다.
- 카카오 OAuth는 로컬에 Kakao 자격이 없어 실제로 검증할 수 없다. 대안으로 로컬 Studio나 Admin API로 테스트 사용자를 만들어 등록부에 넣고 TOTP 등록, 확인, 대시보드, 로그아웃을 확인한다. 테스트 사용자 생성 방법과 세션 주입 가능 여부는 착수 시 검토한다. 확인하지 못한 항목은 evidence에 미검증으로 남긴다.

#### 10.2.7 2단계 후속 (별도 작업)

- 복구 코드(5.3, 4-5): SDK 갱신을 실험하고 사용자 승인을 받는다. 그 전에는 화면에 복구 가능 안내를 넣지 않는다.
- 관리자 세션 유휴 만료(4-7).
- 같은 이메일의 카카오 계정이 자동 연결될 위험(5.1-1)은 실제 운영 등록 때 확인한다.

#### 10.2.8 완료 기준과 문서 갱신

- 10.2.4 테스트가 모두 Red에서 Green으로 바뀌고, 10.2.5 시나리오가 전부 기대대로 나오며, 10.1의 검증 명령이 모두 통과한다.
- 문서 갱신:
  - 이 문서 2절 상태 표
  - `docs/engineering/permissions.md`에 관리자 등록부, 판정 순서, 등록·회수 절차 추가
  - `docs/harness/verification-matrix.md`
  - `docs/engineering/security.md`의 관리자 앱 헤더와 서비스 역할 키 원칙
- `/simplify`를 실행하고 evidence를 남긴다(`docs/harness/evidence/<날짜>-platform-admin-auth.md`). evidence에는 가독성, 예측 가능성, 응집도, 결합도, simplify 결과, 남은 위험을 적는다.

### 10.3 3단계 — 사용자·학원 목록과 대행 세션 (후보 설계)

**착수 전 조사**
- `profiles`, `academies`, `academy_members`, `teachers`의 실제 컬럼, 상태값, RLS를 확인한다. 관리자 전용 조회는 RLS 우회가 아니라 `private.is_platform_admin()` + aal2를 확인하는 `security definer` RPC로 제공한다(후보).
- 서비스의 학원 세션 게이트(`src/features/auth/academy-session-gate.tsx`)와 학원 선택 흐름을 조사한다.

**설계 후보**
- `private.support_sessions`: `id`, `admin_user_id`, `auth_session_id`, `academy_id`, `reason`, `target_member_id`(null이면 원장 화면), `started_at`, `expires_at`(DB `now() + interval '30 minutes'`), `ended_at`, `end_reason`.
- RPC 후보:
  - `platform_admin_list_users`, `platform_admin_list_academies`, `platform_admin_academy_detail`
  - `support_session_start(academy_id, reason)`, `support_session_switch_target(session_id, member_id|null)`, `support_session_end(session_id)`
  - `private.current_support_session()`: 현재 auth 세션, 미만료, 미종료인 대행 세션 하나를 반환한다.
- 관리자 전용 감사 테이블 `private.platform_admin_audit_events`. 보존 기간과 익명화(4-2), 로그인 이벤트 포함 여부(4-8)는 사용자 결정 후 확정한다.
- 화면 후보: `/dashboard/users`, `/dashboard/academies/[id]`, 대행 시작 다이얼로그(사유 입력, 민감정보 금지 안내), 상단 대행 배너(학원, 대상, 남은 시간, 종료).
- 목록 표는 디자인 시스템의 데스크톱 표, 태블릿 행, 모바일 카드 기준을 따른다.

**테스트 목록**
- 단위: 남은 시간 계산, 만료 시 상태
- 컴포넌트: 사유 필수, 배너, 대상 전환 UI
- DB 시나리오:
  - 다른 관리자 세션의 대행 세션 사용 거부
  - 만료 후 거부, 종료 후 거부
  - 다른 학원 멤버를 대상으로 선택하면 거부
  - 비활성 직원 대상 거부
  - 관리자 aal1 거부
  - 원장·직원이 감사 테이블과 대행 세션에 접근하면 거부

**질문할 결정:** 4-2, 4-6(대행 중 직원 상태가 바뀌면 어떻게 처리할지), 4-7, 4-8, 동시 대행 세션 허용 여부, 사유 최소 길이

### 10.4 4단계 — 업무 대행 (후보 설계)

**착수 전 조사**
- 1단계에서 확인한 서비스 라우트 목록(아래)을 화면마다 다음 기준으로 분류한다: 원장, 데스크, 선생님 메뉴 노출 / `auth.uid()` 의존 조회 / 사용하는 RPC와 테이블 / 절대 링크 / 민감정보.
  - 서비스 라우트: `/`, `/lessons{,/academy,/private}`, `/students`, `/teachers`, `/passes`, `/vendors`, `/status-management`, `/management/{students,teachers,vendors,consultations,status}`, `/finance{,/overview,/ledger,/lesson-income,/payroll,/books}`, `/books{,/orders,/paid,/shipments}`, `/settings/{members,teachers,lesson-tickets,lesson-schedule}`, `/onboarding`, `/join`, `/auth/*`, `/api/holidays`
- `private.has_academy_role`과 `private.is_active_academy_member`를 사용하는 모든 정책과 RPC를 `grep`으로 목록화한다.

**설계 후보**
- 권한 함수 확장: 행위자가 관리자이고 유효한 대행 세션이 있으면, 그 세션의 학원과 대상 멤버 역할을 "유효 역할"로 쓰는 `private.effective_academy_role(academy_id)` 같은 단일 경계를 둔다. 정책마다 관리자 예외를 흩뿌리지 않는다.
- `auth.uid()`로 "본인" 범위를 정하는 조회는 `private.effective_member_id()` 같은 함수로 바꾼다. 실제 행위자 ID(감사용)와 화면 대상 ID(범위용)를 분리한다.
- 업무 이력에는 대행 행위자를 노출하지 않고, 관리자 감사 테이블에 따로 남긴다.
- 화면: 서비스 `src/app/**/page.tsx`의 본문을 `src/features/**`의 화면 컴포넌트로 분리한다. 서비스와 관리자 `/support/[sessionId]/...` 라우트는 같은 컴포넌트를 쓰는 얇은 어댑터로 둔다. 링크는 기본 경로를 주입받는다.
- React Query 키에 `academyId`, `targetMemberId`, `supportSessionId`를 포함한다. 전환, 만료, 종료 때 `queryClient.clear()`를 실행하고 다시 마운트한다.

**테스트 목록**
- 기존 서비스 원장, 데스크, 선생님 회귀(unit, e2e 전체)
- 대행 원장 범위와 대행 선생님 범위(본인 수업·급여만)를 DB 시나리오로 확인
- 업무 이력에 관리자가 노출되지 않는지
- 전환 시 이전 데이터가 잔존하지 않는지(컴포넌트)

**질문할 결정:** 대행 제외 기능, 직원 화면에서의 민감정보 범위, 라우트 구조

### 10.5 5단계 — 영구 회원 삭제 (후보 설계)

**착수 전 조사:** 8.1의 전수 조사. 외래키와 `on delete` 동작 표, 트리거, Storage 버킷과 소유 관계, `salary_settlements.teacher_id`와 이름 조인 경로를 정리한다.

**설계 후보**
- 이름 스냅샷 컬럼 추가와 기존 데이터 보완(4-1 결정 반영)
- `private.account_deletion_jobs`: 상태 `previewed`, `locked`, `db_cleaned`, `auth_deleted`, `failed`, 재시도 횟수, 오류
- 미리보기 RPC → 확인 → DB 정리 RPC(트랜잭션) → 서버 route handler에서 Auth Admin `deleteUser`(서버 비밀키) → 검증
- 확인 UX(4-6)는 사용자와 확정한다.

**테스트 목록**
- 원장 단독 삭제, 직원 단독 삭제, A 원장·B 직원 복합 삭제
- 다른 직원 Auth 계정 보존
- 과거 급여와 수업 이름 보존
- 미리보기 이후 변경 감지
- DB 성공 후 Auth 실패 시 재개
- 중복 실행
- Storage 객체로 인한 실패
- 삭제 후 기존 access token으로의 접근 차단

**질문할 결정:** 4-1, 4-2, 4-3, 4-6

### 10.6 6단계 — 품질·운영

- 9절 규칙을 `AGENTS.md`, `docs/harness/agent-loop.md`에 반영하고 `pnpm check:admin-parity`와 CI를 구현한다.
- 관리자 앱 전체 CSP와 보안 헤더를 정리하고 Playwright 관리자 시나리오를 추가한다(관리자 앱용 `playwright` 설정이나 project 분리를 검토).
- 11절 배포 runbook을 `docs/engineering/platform-admin-runbook.md`로 분리한다. 실제 배포처(4-4)를 확인한 뒤 환경변수 목록, OAuth URL, 롤백, 관리자 접근 차단 절차를 구체화한다.

### 10.7 공통 검증 목록

- 단위·컴포넌트: MFA, 오류·복구, 세션 타이머, 화면 대상 전환, 삭제 영향과 부분 실패, 각 화면의 상태
- 격리 Docker/Supabase:
  - 실제 migration 적용·재설정
  - RLS와 RPC의 역할별 허용·거부
  - 만료와 권한 회수
  - 다른 학원 접근
  - `auth.uid()` 개인 범위
  - 동시성, 삭제 관계, 재시도
  - **운영 DB 사용 금지**
- Playwright: 관리자 로그인과 callback 오류, TOTP, 학원 검색, 대행, 원장·직원 화면 전환, 만료, 로그아웃, 삭제 확인 흐름. 데스크톱과 모바일 모두 확인한다. 카카오 실제 외부 인증은 운영 설정 후 별도로 확인한다.
- 기존 앱 회귀: 원장·데스크·선생님 로그인과 업무 권한, 기존 이력과 개인정보 보호, 공통 화면과 링크
- 양 앱의 `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, `pnpm build`와 관리자 앱 전용 명령(0.4), parity 검사
- Evidence: 실패한 테스트와 이유, 최종 명령과 결과, 격리 DB·브라우저·모바일 증거, 실제 검증하지 못한 항목을 분리해 기록한다.

---

## 11. 배포와 운영 순서

1. Docker Desktop 실행을 확인하고(0.3) 로컬 전용 Supabase 스택을 시작한다. 원격 프로젝트 연결 명령이나 운영 migration은 이 단계에서 실행하지 않는다.
2. 로컬에서 각 단계의 기능과 테스트를 완료한다. migration 순서, 기존 데이터 보존과 복원, 릴리스 전후 호환성을 검증한다.
3. 실제 배포처를 확인하고 관리자 앱을 별도 프로젝트와 도메인으로 구성한다. Vercel을 쓴다면 다음을 각각 확인한다.
   - 루트 서비스 프로젝트와 `apps/platform-admin` 프로젝트의 root directory
   - 루트 `src` 공유 소스 접근(모노레포 설정)
   - install과 build 명령
   - 환경별 배포 설정
4. 관리자 앱이 **실제로 사용하는** 환경변수를 목록화한다(Supabase 공개 URL, 공개 키, 서버 전용 관리 키 등). `NEXT_PUBLIC_`에는 비밀키를 넣지 않는다. 기존 앱이 요구하는 서버 전용 환경변수와 공유 API 사용 여부도 따로 조사한다.
5. 원격 Supabase Auth에서 **TOTP MFA 활성화**를 확인한다(로컬 `config.toml`과 별개).
6. 카카오 Developers와 Supabase에서 관리자 도메인과 callback·redirect 허용 주소를 확인한다. 서비스 앱 주소는 유지한다. 운영과 미리보기 URL을 구분하고, 키와 secret은 콘솔과 배포 서비스의 비밀 설정에만 입력한다.
7. 사용자에게 다음을 보여 준다: 변경 내용, 백업·복원과 롤백, migration 순서, 배포할 정확한 버전. **원격 migration은 별도 명시적 요청 시에만** `docs/engineering/supabase-migration-runbook.md`에 따라 적용하고, 이력과 실제 schema를 검증한다. 관리자 권한 부여와 배포도 범위와 시점을 확인해 진행한다.
8. 관리자 계정을 등록하고(10.2.2 콘솔 SQL) TOTP와 복구 절차를 검증한다. 운영 관리자 앱에서 기존 서비스 로그인, 테스트 학원 대행, 권한 거부, 이력 노출을 확인한다. 실제 회원 삭제는 별도 지시 없이 실행하지 않는다.
9. 문제가 생기면 배포 롤백, 관리자 접근 차단(등록부 `revoked_at` 설정), 세션 종료 절차를 실행한다. DB 변경은 앱 롤백만으로 되돌아가지 않으므로 migration마다 호환성, 백업, 복구 방법을 따로 준비한다.

## 12. 품질 정리 기준

- **가독성:** 관리자 인증, 계정 관리, 대행, 삭제 상태를 분리한다. 실제 관리자와 화면 대상의 이름을 혼동하지 않는다(`actorUserId`와 `targetMemberId` 구분).
- **예측 가능성:** 판정 순서(10.2.1), DB 기준 만료, 권한 회수, 선택한 직원의 범위, 삭제 결과와 재시도 상태를 명시한다.
- **응집도:** 공통 학원 업무는 기존 도메인에 둔다. 관리자 등록, 대행 세션, 관리자 감사, 삭제 오케스트레이션은 각자의 책임 영역에 둔다.
- **결합도:** 서비스와 관리자 앱은 화면과 도메인을 공유하되 배포와 인증 경계는 분리한다. 특정 앱의 절대 경로나 전역 관리자 우회에 결합하지 않는다.
- **simplify 결과:** 단계마다 중복 권한 검사, 라우트 분기, 임시 코드, 복사한 업무 로직을 검토해 정리한다. 2026-11-14 초안 인계 커밋에서는 2.3의 사유로 생략했다.

## 13. 참고 자료

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [JavaScript MFA API](https://supabase.com/docs/reference/javascript/auth-mfa), [SDK 변경 이력](https://github.com/supabase/supabase-js/blob/master/CHANGELOG.md)
- [Supabase 사용자 관리와 삭제](https://supabase.com/docs/guides/auth/managing-user-data), [관리자 사용자 삭제 API](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [세션](https://supabase.com/docs/guides/auth/sessions)
- [Supabase 콘솔 MFA](https://supabase.com/docs/guides/platform/multi-factor-authentication), [카카오 로그인](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao)
- [Vercel 모노레포](https://vercel.com/docs/monorepos)
- Next 16 proxy 규칙: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
