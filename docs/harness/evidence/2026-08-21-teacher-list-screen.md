# 2026-08-21 선생님 목록 화면 증거

## 목표

PDF 3-2 선생님 관리 요구사항을 실제 `/teachers` 화면과 Supabase/TanStack Query API 어댑터로 연결한다. 선생님의 담당 파트, 연락처, 등록일, 급여 형태를 운영 화면에서 확인하되 주민등록번호 원문과 보안 참조는 목록 조회/화면에 노출하지 않는다.

## 출처 요구사항

- PDF 3-2: 선생님 등록, 담당 파트, 연락처, 등록일, 주민등록번호, 급여 형태
- PDF 목록 공통: 검색/필터와 가나다순 목록
- 사용자 추가 지시: API는 TanStack Query 사용
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스 방향 유지
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/teacher-list.test.ts`
- 시나리오:
  - 학원 범위 안에서 선생님 목록을 가나다순으로 만든다.
  - 이름, 담당 파트, 연락처, 급여 형태 기준 검색을 지원한다.
  - 담당 파트와 급여 형태 필터를 함께 적용한다.
  - 급여 형태를 운영 화면 표시명으로 바꾼다.
- 초기 실패: `src/domain/teacher-list.ts`가 없어 import 단계에서 실패했다.

- 테스트 파일: `src/lib/api/teachers.test.ts`
- 시나리오:
  - Supabase `teachers` row를 도메인 목록으로 변환하고 `academy_id`로 제한한다.
  - `resident_registration` 관련 컬럼은 select하지 않는다.
  - Supabase 오류를 사용자에게 전달 가능한 오류로 변환한다.
  - query options가 tenant-aware query key와 query function을 제공한다.
- 초기 실패: `src/lib/api/teachers.ts`가 없어 import 단계에서 실패했다.

- 테스트 파일: `src/features/teachers/teacher-list-screen.test.tsx`
- 시나리오:
  - 선생님 목록을 표로 보여주고 담당 파트와 급여 형태를 표시한다.
  - 검색어와 필터 변경을 TanStack Query 입력으로 반영한다.
  - Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다.
- 초기 실패: `src/features/teachers/teacher-list-screen.tsx`가 없어 import 단계에서 실패했다.

- 테스트 파일: `src/app/teachers/page.test.tsx`
- 시나리오:
  - 선생님 메뉴에서 선생님 목록 화면으로 진입할 수 있다.
- 초기 실패: `src/app/teachers/page.tsx`가 없어 import 단계에서 실패했다.

## 구현 내용

- `src/domain/teacher-list.ts`
  - `buildTeacherList`
  - `formatTeacherPayType`
  - 학원 scope, 검색, 담당 파트/급여 형태 필터
- `src/lib/api/teachers.ts`
  - `fetchTeacherList`
  - `createTeacherListQueryOptions`
  - Supabase row 타입과 도메인 `TeacherListRow` 매핑
- `src/lib/api/query-keys.ts`
  - 선생님 목록 query key에 학원 ID, 검색어, 담당 파트, 급여 형태 포함
- `src/features/teachers/teacher-list-screen.tsx`
  - TanStack Query `useQuery` 기반 선생님 목록 화면
  - 검색, 담당 파트 필터, 급여 형태 필터, 초기화, 로딩/빈/오류 상태
- `src/app/teachers/page.tsx`
  - `/teachers` route 추가
- `tests/e2e/home.spec.ts`
  - 홈 메뉴에서 `/teachers`로 이동하는 E2E 추가
- `docs/product/traceability-matrix.md`
  - PDF 3-2 요구사항을 도메인/API/화면/E2E 테스트에 연결

## 정책 처리

- Supabase query는 항상 `academy_id`로 제한한다.
- 선생님 목록 API는 `resident_registration_encrypted_ref`, `resident_registration_masked`를 select하지 않는다.
- 주민등록번호 저장/표시의 상세 정책은 기존 보안 모델과 `docs/engineering/security.md`를 따른다.
- 현재 인증/학원 선택 phase 전이므로 `/teachers`는 임시 개발 tenant id `academy-demo`를 사용한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/teacher-list.test.ts src/lib/api/teachers.test.ts src/features/teachers/teacher-list-screen.test.tsx src/app/teachers/page.test.tsx` | 통과 | 4개 파일, 11개 테스트 통과 |
| `pnpm test:run src/lib/api/query-keys.test.ts src/lib/api/teachers.test.ts` | 통과 | 2개 파일, 6개 테스트 통과 |
| `supabase projects list -o json` | 통과 | `lesson` project ref `zkzqmqtzzlgljkuctpbn`, `ACTIVE_HEALTHY` 확인 |
| `supabase link --project-ref zkzqmqtzzlgljkuctpbn` | 통과 | 현재 repo를 Supabase `lesson` 프로젝트에 연결 |
| `supabase db push --dry-run` | 통과 | 적용 예정 migration 2개 확인, 원격 DB 변경 없음 |
| `pnpm test:run` | 통과 | 33개 파일, 140개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | TypeScript 오류 없음 |
| `pnpm build` | 통과 | `/`, `/students`, `/teachers` production build 통과 |
| `pnpm test:e2e` | 통과 | Chromium E2E 3개 통과 |

## Quality Consolidation

- 선생님 목록 검색/필터 규칙은 UI가 아니라 `src/domain/teacher-list.ts` 순수 함수로 분리했다.
- Supabase의 넓은 client 타입은 화면에서 좁은 `TeacherListSupabaseClient` adapter port로 끊었다.
- 테스트용 query options factory를 주입할 수 있게 해 화면 테스트가 실제 원격 Supabase에 의존하지 않는다.
- 급여 형태 표시명은 한 곳에서 관리해 표, 검색, 이후 form에서 재사용할 수 있게 했다.

## 남은 리스크

- 원격 Supabase DB에는 아직 migration을 적용하지 않았기 때문에 실제 데이터 조회 성공은 검증하지 못했다.
- 선생님 등록/수정 mutation과 주민등록번호 보안 저장 흐름은 아직 구현하지 않았다.
- Supabase Auth 기반 tenant 선택, 로그인, RLS 런타임 검증은 다음 phase에서 이어서 처리해야 한다.
- `supabase db push --dry-run`은 통과했지만 실제 `supabase db push`는 사용자 명시 승인 후 실행해야 한다.
- `pnpm build`와 `pnpm test:e2e`에서 Supabase JS가 Node.js 22 이상을 권장한다는 경고가 표시됐다.
