# 2026-08-21 원생 목록 Supabase Query 증거

## 목표

원생 목록 도메인 규칙을 Supabase persistence와 TanStack Query API 상태 관리로 연결하는 첫 API 어댑터를 만든다.

## 출처 요구사항

- 사용자 추가 지시: API 상태 관리는 TanStack Query 사용
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스
- PDF 3-1: 원생 목록 검색/정렬
- `docs/product/traceability-matrix.md`
- `docs/engineering/architecture.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/lib/api/query-keys.test.ts`
- 시나리오:
  - 원생 목록 query key에 학원 ID, 상태, 검색어, 선생님, 악기, 정기 요일 필터 포함
- 초기 실패: 기존 query key가 선생님/악기/요일 필터를 포함하지 않아 실패했다.

- 테스트 파일: `src/lib/api/students.test.ts`
- 시나리오:
  - Supabase `students` row와 `student_instruments` nested row를 `StudentListRow`로 변환
  - Supabase 오류를 사용자에게 전달 가능한 오류로 변환
  - query options가 tenant-aware query key와 query function을 함께 제공
- 초기 실패: `src/lib/api/students.ts`가 없어 테스트가 실패했다.

## 구현 내용

- `src/lib/api/query-keys.ts`
  - 원생 목록 query key에 `teacherName`, `instrumentName`, `weekdayLabel` 추가
- `src/lib/api/students.ts`
  - `fetchStudentList`
  - `createStudentListQueryOptions`
  - Supabase row 타입과 도메인 `StudentListRow` 매핑
- `docs/product/traceability-matrix.md`
  - API cache 격리와 원생 목록 요구사항을 API 테스트/구현에 연결

## 정책 처리

- Supabase query는 항상 `academy_id`로 먼저 제한한다.
- 목록 검색/필터 계산은 기존 `buildStudentList` 도메인 함수를 재사용한다.
- 클라이언트 cache key는 학원 ID와 필터 전체를 포함해 학원 간 데이터 섞임과 필터 충돌을 막는다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/lib/api/query-keys.test.ts` | 통과 | unit 2개 테스트 통과 |
| `pnpm test:run src/lib/api/students.test.ts` | 통과 | unit 3개 테스트 통과 |
| `pnpm test:run` | 통과 | 26개 파일, 121개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | 테스트 stub 타입 보강 후 통과 |
| `pnpm build` | 통과 | Next.js production build 통과 |
| `pnpm test:e2e` | 통과 | build 후 Chromium E2E 1개 통과 |

## Quality Consolidation

- Supabase row 타입을 명시적으로 export해 테스트가 `unknown`에 기대지 않도록 정리했다.
- query option 생성은 `queryKey`와 `queryFn`만 반환해 hook/컴포넌트에서 재사용하기 쉽게 했다.
- UI가 아닌 API adapter에서 도메인 목록 로직을 호출하게 만들어 화면별 중복 검색/필터 구현을 피했다.
- 완료 직전 전체 검증을 다시 실행해 API adapter 변경이 기존 도메인/화면 smoke 검증을 깨지 않는지 확인했다.

## 남은 리스크

- 실제 Supabase DB 호출은 로컬 DB/Docker 미실행으로 통합 테스트하지 못했다.
- 다음 phase에서 이 query options를 실제 원생 목록 화면 또는 route/server boundary에 연결해야 한다.
