# 2026-08-21 회차권 목록 화면 증거

## 목표

PDF 2 회차권 요구사항 중 회차권 목록과 잔여 부족/만료 임박 상태 표시를 `/passes` 화면과 Supabase/TanStack Query API 어댑터로 연결한다. 운영자는 현재 학원의 회차권 목록에서 원생, 악기, 총 부여 회수, 잔여 회수, 유효기간, 상태를 확인하고 검색/필터할 수 있어야 한다.

## 출처 요구사항

- PDF 2: 개인레슨은 월 고정 수강료가 아니라 회차권/횟수 기반으로 관리한다.
- PDF 2: 목록은 총 부여 회수, 잔여 회수, 유효기간, 만료일을 표시한다.
- PDF 2: 잔여 회수가 적거나 만료가 가까우면 시각적으로 강조한다.
- 사용자 추가 지시: API는 TanStack Query 사용
- 사용자 추가 지시: UI는 shadcn/ui 컴포넌트 조합을 우선 사용
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스 방향 유지

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/lesson-ticket.test.ts`
  - 현재 학원의 회차권 목록을 원생명 가나다순으로 만들고 상태를 계산한다.
  - 검색어와 상태 필터를 적용한다.
  - 회차권 상태를 운영자가 읽는 한국어로 표시한다.
  - 초기 실패: `buildLessonTicketList`, `formatLessonTicketStatus`가 없었다.
- 테스트 파일: `src/lib/api/query-keys.test.ts`
  - 회차권 목록 query key에 `academyId`, 검색어, 상태를 포함한다.
  - 초기 실패: `queryKeys.lessonTickets.list`가 없었다.
- 테스트 파일: `src/lib/api/lesson-tickets.test.ts`
  - Supabase `lesson_ticket_grants` row를 회차권 목록으로 변환하고 `academy_id`로 제한한다.
  - Supabase 오류를 사용자에게 전달 가능한 오류로 변환한다.
  - query options가 tenant-aware query key와 query function을 제공한다.
  - 초기 실패: `src/lib/api/lesson-tickets.ts`가 없었다.
- 테스트 파일: `src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx`
  - 회차권 목록을 표로 보여주고 원생, 악기, 총/잔여 회수, 유효기간, 상태를 표시한다.
  - 검색어와 상태 필터 변경을 TanStack Query 입력으로 반영한다.
  - Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다.
  - 초기 실패: `src/features/lesson-tickets/lesson-ticket-list-screen.tsx`가 없었다.
- 테스트 파일: `src/app/passes/page.test.tsx`, `tests/e2e/home.spec.ts`
  - 회차권 메뉴에서 `/passes` 회차권 관리 화면으로 진입할 수 있다.
  - 초기 실패: `/passes` route가 없었다.

## 구현 내용

- `src/domain/lesson-ticket.ts`
  - `LessonTicketListItem`
  - `LessonTicketListRow`
  - `buildLessonTicketList`
  - `formatLessonTicketStatus`
- `src/lib/api/lesson-tickets.ts`
  - `fetchLessonTicketList`
  - `createLessonTicketListQueryOptions`
  - Supabase `lesson_ticket_grants` row와 도메인 목록 row 매핑
- `src/lib/api/query-keys.ts`
  - 회차권 목록 query key에 학원 ID, 검색어, 상태 포함
- `src/features/lesson-tickets/lesson-ticket-list-screen.tsx`
  - TanStack Query `useQuery` 기반 회차권 목록 화면
  - 검색, 상태 필터, 초기화, 로딩/빈/오류 상태
  - shadcn `Button`, `Badge`, `Input`, `NativeSelect`, `Alert`, `Table` 조합 사용
- `src/app/passes/page.tsx`
  - `/passes` route 추가
- `tests/e2e/home.spec.ts`
  - 홈 메뉴에서 `/passes`로 이동하는 E2E 추가
- `docs/product/traceability-matrix.md`
  - PDF 2 회차권 상태 표시 요구사항을 도메인/API/화면/E2E 테스트에 연결

## 정책 처리

- Supabase query는 항상 `academy_id`로 제한한다.
- 기존 migration의 `lesson_ticket_grants` RLS는 owner/desk select를 전제로 한다.
- 잔여 부족 기준은 현재 phase에서 기존 테스트 기준과 같은 2회 이하로 두고, 만료 임박은 7일 이하로 표시한다.
- 회차권 등록, 재등록, 수동 수정 mutation은 권한/감사 로그 정책과 함께 별도 phase에서 진행한다.
- 현재 인증/학원 선택 phase 전이므로 `/passes`는 임시 개발 tenant id `academy-demo`를 사용한다.
- 회차권 상태 기준일은 route에서 실행 시점 날짜를 ISO 날짜로 계산해 전달한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/lesson-ticket.test.ts src/lib/api/query-keys.test.ts src/lib/api/lesson-tickets.test.ts src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx src/app/passes/page.test.tsx` | 통과 | 5개 파일, 31개 테스트 통과 |
| `pnpm test:run` | 통과 | 46개 파일, 181개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 통과 |
| `pnpm typecheck` | 통과 | route type 생성 및 `tsc --noEmit` 통과 |
| `pnpm build` | 통과 | `/passes` 포함 8개 app route 빌드 통과 |
| `pnpm test:e2e` | 통과 | 7개 E2E 통과, 회차권 메뉴 진입 포함 |
| Quality Consolidation 후 `pnpm test:run src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx src/app/passes/page.test.tsx` | 통과 | 2개 파일, 4개 테스트 통과 |
| Quality Consolidation 후 `pnpm test:run` | 통과 | 46개 파일, 181개 테스트 통과 |
| Quality Consolidation 후 `pnpm lint` | 통과 | ESLint 통과 |
| Quality Consolidation 후 `pnpm typecheck` | 통과 | route type 생성 및 `tsc --noEmit` 통과 |
| Quality Consolidation 후 `pnpm build` | 통과 | `/passes` 포함 app route 빌드 통과 |
| Quality Consolidation 후 `pnpm test:e2e` | 통과 | 7개 E2E 통과 |

## Quality Consolidation

- 회차권 상태 계산은 기존 `summarizeLessonTicketStatus`를 재사용하고 목록 검색/필터만 `buildLessonTicketList`에 추가했다.
- Supabase client 타입은 `LessonTicketListSupabaseClient` adapter port로 좁혀 화면 테스트가 원격 DB에 의존하지 않게 했다.
- 목록 UI는 원생/선생님/거래처/교재/수입과 같은 `src/components/management/list-controls.tsx` shadcn 조합을 재사용했다.
- 상태 한글 라벨은 도메인 formatter로 모아 테스트 가능하게 했다.
- 표는 작은 화면에서 레이아웃이 깨지지 않도록 가로 overflow 컨테이너 안에 둔다.
- route의 상태 기준일은 하드코딩하지 않고 실행 시점 날짜로 계산한다.
- 품질 정리 후 전체 unit/component/lint/type/build/E2E를 다시 실행했다.

## 남은 리스크

- 원격 Supabase DB에는 아직 migration을 적용하지 않았기 때문에 실제 데이터 조회 성공은 검증하지 못했다.
- 회차권 등록/재등록, 출석 차감 mutation, 수동 수정 mutation은 아직 화면으로 구현하지 않았다.
- 잔여 부족/만료 임박 기준은 학원별 설정으로 분리할 수 있지만 현재는 화면 기본값으로 둔다.
- `supabase db push --dry-run`은 통과했지만 실제 `supabase db push`는 사용자 명시 승인 후 실행해야 한다.
- Supabase JS가 Node 22 이상 업그레이드를 권장한다.
