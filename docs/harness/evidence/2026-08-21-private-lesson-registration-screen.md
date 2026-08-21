# 2026-08-21 개인레슨 등록 화면 증거

## 목표

PDF 1-2의 개인레슨 등록 흐름을 `/lessons` 화면에서 시작할 수 있게 한다. 운영자는 레슨 시간표 화면에서 개인레슨 등록 다이얼로그를 열고, 원생, 해당 원생의 활성 개인레슨 악기, 선생님, 시간을 순서대로 입력해 개인레슨 일정을 등록할 수 있어야 한다.

## 출처 요구사항

- PDF 1-2: 개인레슨 등록은 원생, 악기, 선생님, 시간 순서로 진행한다.
- PDF 1-2: 개인레슨 악기 선택은 원생이 수강 중인 개인레슨 악기로 제한한다.
- PDF 1-2: 같은 선생님과 같은 시간 중복 등록을 막는다.
- 사용자 추가 지시: API는 TanStack Query를 사용한다.
- 사용자 추가 지시: UI는 shadcn/ui 컴포넌트 조합을 우선 사용한다.
- 사용자 추가 지시: 여러 음악학원이 가입하는 멀티테넌트 서비스 방향을 유지한다.

## 먼저 작성한 테스트

- `src/lib/api/query-keys.test.ts`
  - 개인레슨 등록 선택지 query key가 학원별로 분리되는지 검증했다.
  - 초기 실패: `queryKeys.privateLessons.registrationOptions`가 없었다.
- `src/lib/api/private-lessons.test.ts`
  - 현재 학원의 원생, 활성 개인레슨 악기, 선생님 선택지를 만든다.
  - 선생님 시간 충돌이 없으면 `lesson_events`에 개인레슨 일정을 insert한다.
  - 선생님 시간 충돌이 있으면 저장 전에 거부한다.
  - 초기 실패: `src/lib/api/private-lessons.ts`가 없었다.
- `src/features/private-lessons/private-lesson-registration-screen.test.tsx`
  - 개인레슨 등록 다이얼로그가 원생, 악기, 선생님, 시간 순서를 보여준다.
  - 폼 입력을 mutation 입력으로 전달한다.
  - 초기 실패: 화면 파일이 없었다.
- `src/app/lessons/page.test.tsx`, `tests/e2e/home.spec.ts`
  - 레슨 시간표 메뉴에서 `/lessons` 화면으로 진입하고 개인레슨 등록 다이얼로그를 열 수 있다.
  - 초기 실패: `/lessons` route가 없었다.

## 구현 내용

- `src/lib/api/query-keys.ts`
  - `queryKeys.privateLessons.registrationOptions(academyId)` 추가
- `src/lib/api/private-lessons.ts`
  - `fetchPrivateLessonRegistrationOptions`
  - `createPrivateLessonRegistrationOptionsQueryOptions`
  - `registerPrivateLessonEvent`
  - Supabase `students`, `student_instruments`, `teachers`, `lesson_events` row를 도메인/화면 모델로 변환
  - 저장 전 `findPrivateLessonRegistrationBlocker`로 선생님 시간 충돌 방어
- `src/features/private-lessons/private-lesson-registration-screen.tsx`
  - shadcn `Dialog`, `Button`, `Badge`, `Input`, `Label`, `NativeSelect` 기반 개인레슨 등록 UI
  - TanStack Query `useQuery`로 등록 선택지를 가져오고 `useMutation`으로 등록 실행
  - 등록 성공 시 개인레슨 query invalidate와 Sonner toast 표시
- `src/app/lessons/page.tsx`
  - `/lessons` route와 AppShell 연결
- `tests/e2e/home.spec.ts`
  - 레슨 시간표 메뉴 진입과 개인레슨 등록 다이얼로그 열림 검증
- `docs/product/traceability-matrix.md`
  - PDF 1-2 개인레슨 등록 요구사항을 API/화면/E2E 테스트와 연결

## Supabase 확인

- Supabase skill을 읽고 보안 체크리스트를 확인했다.
- Supabase 공식 문서에서 `.select().eq()`, `.insert().select().single()`, `.order()` 사용 방식을 확인했다.
- 이번 phase는 원격 DB schema 변경 없이 기존 `students`, `student_instruments`, `teachers`, `lesson_events`를 사용한다.
- 실제 원격 DB migration 적용은 사용자 명시 승인 전에는 실행하지 않는다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/lib/api/query-keys.test.ts src/lib/api/private-lessons.test.ts src/features/private-lessons/private-lesson-registration-screen.test.tsx src/app/lessons/page.test.tsx` | 통과 | 4개 파일, 15개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 통과 |
| `pnpm typecheck` | 통과 | route type 생성 및 `tsc --noEmit` 통과 |
| `pnpm test:run` | 통과 | 49개 파일, 194개 테스트 통과 |
| `pnpm build` | 통과 | `/lessons` 포함 9개 app route 빌드 통과 |
| `pnpm test:e2e` | 통과 | 8개 E2E 통과, 레슨 시간표 메뉴와 개인레슨 등록 다이얼로그 열림 포함 |

## Quality Consolidation

- 시간 충돌 판단은 API에 중복하지 않고 기존 도메인 `findPrivateLessonRegistrationBlocker`를 재사용했다.
- 원생별 악기 선택지는 활성 개인레슨 악기만 남기고 학원 수업 악기는 제거했다.
- Dialog 테스트는 role/label 중심으로 작성하고, 단계 표시는 `개인레슨 등록 단계` list 안에서 검증하게 했다.
- Supabase client는 선택지 조회와 등록 포트로 분리해 원격 DB 없이 테스트 가능하게 했다.
- 전체 검증을 다시 실행해 `/lessons` route 추가가 기존 화면과 E2E 흐름을 깨지 않는지 확인했다.

## 남은 리스크

- 현재 `/lessons`는 개인레슨 등록 진입점 중심이며 학원 피아노 캘린더, 일별 출석 모달, 결석 인원 목록은 별도 phase로 남아 있다.
- 개인레슨 등록 시 실제 회차권 차감은 하지 않는다. PDF 전역 규칙대로 출석 확인 phase에서만 차감해야 한다.
- 등록 선택지의 최근 레슨/잔여 회차 검색 결과 UI는 도메인 로직은 있으나 화면 반영이 아직 남아 있다.
- 실제 인증/학원 선택 phase 전이므로 `/lessons`는 개발 tenant id `academy-demo`를 사용한다.
