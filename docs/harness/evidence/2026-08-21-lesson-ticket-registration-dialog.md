# 2026-08-21 회차권 등록 다이얼로그 증거

## 목표

PDF 2의 회차권 신규 등록/재등록 요구사항을 `/passes` 화면에서 수행할 수 있게 한다. 운영자는 회차권 목록 화면에서 원생과 개인레슨 악기를 선택하고, 부여 회수와 유효기간을 입력해 새 회차권을 만들거나 기존 회차권에 회수를 추가할 수 있어야 한다.

## 출처 요구사항

- PDF 2: 개인레슨은 회차권/횟수 기반으로 관리한다.
- PDF 2: 회차권 재등록은 회수 추가와 유효기간 갱신을 지원한다.
- PDF 1-2: 개인레슨 악기 선택은 원생이 수강 중인 개인레슨 악기를 기준으로 한다.
- 사용자 추가 지시: API는 TanStack Query를 사용한다.
- 사용자 추가 지시: UI는 shadcn/ui 컴포넌트 조합을 우선 사용한다.
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스 방향을 유지한다.

## 먼저 작성한 테스트

- `src/lib/api/query-keys.test.ts`
  - 회차권 등록 선택지 query key가 학원별로 분리되는지 검증했다.
  - 초기 실패: `queryKeys.lessonTickets.registrationOptions`가 없었다.
- `src/lib/api/lesson-tickets.test.ts`
  - 원생과 활성 개인레슨 악기만 회차권 등록 선택지로 변환하는지 검증했다.
  - 기존 회차권이 있으면 `registerLessonTicket` 도메인 규칙으로 회수/유효기간을 병합한 뒤 update하는지 검증했다.
  - 기존 회차권이 없으면 insert하는지 검증했다.
  - 초기 실패: `fetchLessonTicketRegistrationOptions`, `registerLessonTicketGrant`가 없었다.
- `src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx`
  - 회차권 등록 다이얼로그에서 원생, 악기, 부여 회수, 유효기간, 등록일을 입력하면 mutation 입력이 만들어지는지 검증했다.
  - 초기 실패: `회차권 등록` 버튼이 다이얼로그를 열지 않았다.
- `tests/e2e/home.spec.ts`
  - 회차권 화면에서 `회차권 등록` 다이얼로그가 열리는지 확인한다.

## 구현 내용

- `src/lib/api/query-keys.ts`
  - `queryKeys.lessonTickets.registrationOptions(academyId)` 추가
- `src/lib/api/lesson-tickets.ts`
  - `fetchLessonTicketRegistrationOptions`
  - `createLessonTicketRegistrationOptionsQueryOptions`
  - `registerLessonTicketGrant`
  - Supabase `students -> student_instruments` 선택지를 화면 옵션으로 변환
  - Supabase `lesson_ticket_grants` 조회 후 기존 회차권 update 또는 신규 insert
- `src/features/lesson-tickets/lesson-ticket-list-screen.tsx`
  - shadcn `Dialog`, `Button`, `Input`, `Label`, `NativeSelect` 기반 회차권 등록 폼
  - TanStack Query `useQuery`로 등록 선택지를 가져오고 `useMutation`으로 등록 실행
  - 등록 성공 시 회차권 query를 invalidate하고 Sonner toast 표시
- `tests/e2e/home.spec.ts`
  - 회차권 등록 다이얼로그 열림 검증 추가
- `docs/product/traceability-matrix.md`
  - 회차권 재등록 요구사항을 API/화면/E2E 테스트와 연결

## Supabase 확인

- Supabase skill을 읽고 보안 체크리스트를 확인했다.
- Supabase 공식 문서에서 `select`, `eq`, `insert`, `update`, `single`, `order`, `limit` 체인을 확인했다.
- 이번 phase는 원격 DB schema 변경 없이 기존 `lesson_ticket_grants`, `students`, `student_instruments`를 사용한다.
- 실제 원격 DB migration 적용은 사용자 명시 승인 전에는 실행하지 않는다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/lib/api/query-keys.test.ts src/lib/api/lesson-tickets.test.ts src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx` | 통과 | 3개 파일, 18개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 통과 |
| `pnpm typecheck` | 통과 | route type 생성 및 `tsc --noEmit` 통과 |
| Quality Consolidation 중 `pnpm test:run src/domain/lesson-ticket.test.ts` | 의도한 실패 후 통과 | 유효 만료일이 시작일보다 빠른 등록 방어 테스트 추가 |
| Quality Consolidation 후 `pnpm test:run src/domain/lesson-ticket.test.ts src/lib/api/query-keys.test.ts src/lib/api/lesson-tickets.test.ts src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx` | 통과 | 4개 파일, 36개 테스트 통과 |
| `pnpm test:run` | 통과 | 46개 파일, 187개 테스트 통과 |
| `pnpm build` | 통과 | `/passes` 포함 8개 app route 빌드 통과 |
| `pnpm test:e2e` | 통과 | 7개 E2E 통과, 회차권 등록 다이얼로그 열림 포함 |

## Quality Consolidation

- DB mutation도 도메인 `registerLessonTicket`을 재사용해 회수 병합 규칙이 UI/API에 중복되지 않게 했다.
- DB 제약과 같은 날짜 순서 규칙을 도메인 `registerLessonTicket`에서 먼저 검증하게 했다.
- 등록 선택지는 활성 개인레슨 악기만 노출해 학원 피아노와 비활성 악기가 섞이지 않게 했다.
- 등록 폼은 shadcn 컴포넌트 조합으로 만들고, 테스트는 label/role 중심으로 유지했다.
- Supabase client는 목록, 선택지, 등록 포트를 타입으로 나눠 테스트가 원격 DB에 의존하지 않게 했다.

## 남은 리스크

- 현재 등록 mutation은 기존 회차권 조회 후 update/insert를 수행한다. 동시 등록에 대한 강한 원자성이 필요하면 별도 DB RPC 또는 unique 정책을 설계해야 하며, 이는 schema 변경이므로 사용자 확인 후 진행한다.
- 원격 Supabase DB에는 아직 migration을 적용하지 않았기 때문에 실제 데이터 저장 성공은 검증하지 못했다.
- 실제 인증/학원 선택 phase 전이므로 `/passes`는 개발 tenant id `academy-demo`를 사용한다.
- 회차권 수동 수정과 출석 차감 mutation 화면은 아직 별도 phase로 남아 있다.
