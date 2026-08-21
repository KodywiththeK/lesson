# 2026-08-21 통합 데모 데이터와 다이얼로그 운영 흐름 보강

## 요약

- 목표: PDF 요구사항과 `수업.html` 와이어프레임 참고를 바탕으로 원생, 선생님, 레슨 시간표, 회차권, 수입, 거래처, 교재 데이터가 한 앱 상태 안에서 유기적으로 움직이게 보강한다.
- 완료한 변경: 전역 데모 상태 provider, 레슨 날짜별 출석 다이얼로그, 회차권 구매 수입 자동 반영, 원생/선생님/거래처/교재/수입 등록 다이얼로그, 모바일 레이아웃 안정화를 추가했다.
- 커버한 요구사항: 원생 등록 시 일정 반영, 개인레슨 출석 시 회차권 1회 차감, 회차권 결제 시 수입 자동 생성, 주요 버튼의 실제 동작, shadcn/ui Dialog 기반 운영 UX, 예시 데이터 기반 즉시 탐색.

## 먼저 작성한 테스트

- 테스트 파일:
  - `src/lib/demo/academy-demo-state.test.ts`
  - `src/app/integrated-demo-flow.test.tsx`
  - `src/app/students/page.test.tsx`
  - `src/app/teachers/page.test.tsx`
  - `src/app/finance/page.test.tsx`
  - `src/app/vendors/page.test.tsx`
  - `src/app/books/page.test.tsx`
  - `src/lib/api/lesson-tickets.test.ts`
  - `src/lib/supabase/schema-contract.test.ts`
- 시나리오:
  - 원생 등록이 학생 목록, 레슨 일정, 수강료 수입 예정 데이터를 함께 만든다.
  - 회차권 등록이 회차권 목록과 수입 목록에 함께 반영된다.
  - 개인레슨 출석 확인이 동일 원생/악기의 회차권 잔여 회수를 1회 차감한다.
  - 수입, 거래처, 교재 출고 버튼이 다이얼로그를 열고 목록에 반영한다.
  - 회차권 구매 금액을 저장할 DB 컬럼과 `ledger_entry_source` enum 값이 스키마 계약에 존재한다.
- 초기 실패: 전역 데모 상태와 등록/차감 함수, 다이얼로그 연결, `lesson-ticket` 수입 소스가 없어 테스트가 실패하는 상태에서 구현을 시작했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run --reporter=dot` | 통과 | 54 files, 224 tests |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | `next typegen --webpack && tsc --noEmit` |
| `pnpm build` | 통과 | Supabase JS의 Node.js 20 deprecation warning 표시 |
| `git diff --check` | 통과 | whitespace 오류 없음 |
| Playwright smoke | 통과 | 레슨 출석 다이얼로그, 회차권 등록 다이얼로그, 모바일 교재 출고 다이얼로그 |

## 브라우저 증거

- URL: `http://localhost:3002`
- 데스크톱 스크린샷:
  - `/tmp/lesson-private-dialog.png`
  - `/tmp/lesson-ticket-dialog.png`
- 모바일 스크린샷:
  - `/tmp/books-mobile-dialog-viewport.png`
- 확인 내용:
  - `/lessons` 개인레슨표 날짜 클릭 시 `2026-08-21 개인레슨 출석 확인` 다이얼로그가 열린다.
  - `/passes` 회차권 등록 버튼이 등록 다이얼로그를 연다.
  - `/books` 모바일 390px viewport에서 교재 출고 다이얼로그가 화면 안에 들어온다.
  - 루트 가로 스크롤 방지 검증 결과 `scrollX: 0`, `dialogFits: true`.

## Supabase 증거

- Migration: `supabase/migrations/20260821120207_lesson_ticket_purchase_income.sql`
- 변경 내용:
  - `public.ledger_entry_source` enum에 `lesson-ticket` 추가.
  - `public.lesson_ticket_grants.paid_amount` 추가.
  - `public.lesson_ticket_grants.paid_at` 추가.
  - `supabase/seed.sql`에 회차권 구매 수입 예시 데이터 추가.
- 원격 반영:
  - `supabase link --project-ref zkzqmqtzzlgljkuctpbn` 완료.
  - `supabase db push --dry-run`으로 대상 migration 확인.
  - `supabase db push`로 원격 프로젝트에 적용.
  - `supabase migration list --linked`에서 local/remote 모두 `20260821120207`까지 정렬됨.
- 비고:
  - `psql`이 설치되어 있지 않고 Docker daemon이 실행 중이 아니어서 `information_schema` 직접 조회와 `supabase db dump`는 수행하지 못했다.
  - 스키마 계약 테스트로 앱 레벨 기대 컬럼과 enum 값을 고정했다.

## 품질 정리

- 코드 단순화:
  - 데모 변경 로직을 `src/lib/demo/academy-demo-state.ts`의 순수 reducer 성격 함수로 모았다.
  - 페이지별 임시 상태 대신 `DemoAcademyProvider`에서 동일 데이터를 공유하게 했다.
- 재사용한 추상화:
  - 기존 shadcn/ui `Dialog`, `Button`, `Table`, `Input`, `NativeSelect` 조합을 우선 사용했다.
  - 기존 TanStack Query invalidate 패턴과 query key 구조를 유지했다.
- 테스트 정리:
  - 사용자 행동 중심으로 다이얼로그 열기, 폼 입력, 목록 반영을 검증했다.
  - 회차권 차감과 수입 자동 생성은 도메인 상태 테스트와 통합 화면 테스트를 함께 두어 회귀 방어 범위를 나눴다.
- 남은 부채:
  - 현재 데모 상태는 브라우저 세션 메모리 기반이다. 실제 운영 저장/수정/삭제 흐름은 Supabase mutation과 RLS 테스트를 기능별로 확장해야 한다.
  - Node.js 22 업그레이드가 필요하다.

## 위험과 확인 질문

- 위험:
  - 실제 원격 DB에 예시 seed를 넣지는 않았다. 운영/데모 계정 정책 확정 후 별도 적용이 필요하다.
  - 회차권 출석 차감은 현재 데모 상태와 API 구매 수입 저장까지 연결했다. 실제 출석 기록 mutation과 트랜잭션 차감은 다음 DB persistence 단계에서 보강해야 한다.
- 후속 질문:
  - 실제 서비스 가입형 구조에서 학원 생성/초대/역할 부여 온보딩 정책이 필요해질 때 사용자 확인이 필요하다.

## Git

- 커밋: 예정
- push 여부: 사용자가 직접 push
