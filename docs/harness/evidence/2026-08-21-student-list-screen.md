# 2026-08-21 원생 목록 화면 증거

## 목표

PDF 3-1 원생 목록 요구사항을 실제 `/students` 화면으로 연결하고, TanStack Query 기반 데이터 조회, 검색, 선생님/악기/요일 필터, 오류 상태를 운영자가 확인할 수 있게 만든다.

## 출처 요구사항

- PDF 3-1: 원생 목록, 검색/정렬
- 사용자 추가 지시: API는 TanStack Query 사용
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스 방향 유지
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/features/students/student-list-screen.test.tsx`
- 시나리오:
  - 원생 목록을 표로 보여주고 선생님, 악기, 정기 요일을 함께 표시한다.
  - 검색어와 필터 변경을 TanStack Query 입력으로 반영한다.
  - Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다.
- 초기 실패: `src/features/students/student-list-screen.tsx` 파일이 없어 import 단계에서 실패했다.

- 테스트 파일: `src/app/students/page.test.tsx`
- 시나리오:
  - 원생 메뉴에서 원생 목록 화면으로 진입할 수 있다.
- 초기 실패: `src/app/students/page.tsx` 파일이 없어 import 단계에서 실패했다.

- 테스트 파일: `src/lib/supabase/env.test.ts`
- 시나리오:
  - 최신 Supabase `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 공개 키로 사용한다.
  - 기존 `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 하위 호환으로 허용한다.
- 초기 실패: env helper가 `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 요구했다.

## 구현 내용

- `src/features/students/student-list-screen.tsx`
  - TanStack Query `useQuery`로 원생 목록 query options를 실행한다.
  - 검색어, 선생님, 악기, 요일 필터를 화면 상태와 query key/queryFn 입력으로 연결한다.
  - 원생 등록 액션, 초기화 버튼, 표, 빈 상태, 로딩 상태, 오류 상태를 제공한다.
- `src/app/students/page.tsx`
  - `/students` route를 추가하고 공통 `AppShell` 안에 원생 목록 화면을 배치했다.
- `src/app/app-shell.tsx`
  - 대시보드 기본 본문은 유지하면서 페이지별 본문과 제목을 받을 수 있게 확장했다.
- `src/lib/supabase/env.ts`
  - Supabase 최신 publishable key 환경변수를 우선 사용하고 기존 anon key를 하위 호환으로 지원한다.
- `.env.local.example`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 기준으로 갱신했다.
- `.env.local`
  - 사용자가 제공한 Supabase URL과 publishable key를 로컬 실행용으로 설정했다. 이 파일은 `.gitignore` 대상이라 커밋하지 않는다.
- `tests/e2e/home.spec.ts`
  - 홈 메뉴에서 `/students`로 이동해 원생 관리 화면과 검색 입력을 확인하는 E2E를 추가했다.

## 정책 처리

- 현재 인증/학원 선택 phase 전이므로 `/students`는 임시 개발 tenant id `academy-demo`를 사용한다.
- 실제 학원 tenant 판별은 Supabase Auth/session phase에서 사용자 소속 학원 선택 또는 기본 학원 정책으로 교체해야 한다.
- Supabase runtime env는 최신 publishable key를 사용한다. `service_role` 키는 브라우저/일반 SSR 클라이언트에 사용하지 않는다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/features/students/student-list-screen.test.tsx` | 통과 | component 3개 테스트 통과 |
| `pnpm test:run src/app/students/page.test.tsx` | 통과 | component 1개 테스트 통과 |
| `pnpm test:run src/lib/supabase/env.test.ts` | 통과 | unit 3개 테스트 통과 |
| `pnpm test:run src/features/students/student-list-screen.test.tsx src/app/students/page.test.tsx src/lib/supabase/env.test.ts src/lib/api/students.test.ts` | 통과 | 4개 파일, 10개 테스트 통과 |
| `pnpm test:run` | 통과 | 28개 파일, 126개 테스트 통과 |
| `pnpm lint` | 통과 | React hook lint 수정 후 통과 |
| `pnpm typecheck` | 통과 | Supabase client 타입 경계 정리 후 통과 |
| `pnpm build` | 통과 | `/`, `/_not-found`, `/students` production build 통과 |
| `pnpm test:e2e` | 통과 | Chromium E2E 2개 통과 |

## Quality Consolidation

- Supabase의 복잡한 제네릭 타입이 화면 컴포넌트로 새지 않도록 `StudentListSupabaseClient`라는 좁은 adapter port로 경계를 끊었다.
- 테스트용 query options factory를 주입할 수 있게 해 컴포넌트 테스트가 실제 원격 Supabase에 의존하지 않게 했다.
- 검색/필터 처리는 UI에서 다시 구현하지 않고 기존 `buildStudentList` 도메인 규칙과 API adapter를 재사용한다.
- AppShell은 대시보드 기능을 유지하면서 페이지 본문만 교체 가능한 구조로 단순 확장했다.
- Supabase migration 준비물은 `docs/engineering/supabase-setup.md`에 분리해 공개 키, 비밀 키, DB 변경 권한의 용도를 혼동하지 않게 했다.

## 남은 리스크

- 원격 Supabase DB에는 아직 migration을 적용하지 않았기 때문에 실제 데이터 조회 성공은 검증하지 못했다.
- Supabase Auth 기반 tenant 선택, 로그인, session refresh proxy, RLS 런타임 검증은 다음 phase에서 이어서 처리해야 한다.
- 원생 등록 다이얼로그와 저장 mutation은 아직 구현하지 않았다.
- `pnpm build`와 `pnpm test:e2e`에서 Supabase JS가 Node.js 22 이상을 권장한다는 경고가 표시됐다. 현재 빌드는 통과했지만 런타임 버전 정책을 정해야 한다.
