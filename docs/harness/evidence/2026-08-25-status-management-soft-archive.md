# 2026-08-25 휴원/퇴원 통합 관리와 soft archive

## 요약

- 목표: 원생 휴원/퇴원, 선생님 휴직/퇴사 대상을 통합 메뉴에서 별도 관리하고 30일 보관 후 hard delete가 아닌 soft archive로 숨긴다.
- 완료한 변경: `/status-management` 메뉴와 탭 화면, 상태별 전환 버튼, shadcn `AlertDialog` 확인창, 상태 변경 메모, Supabase 보관/감사 migration, Cron 스케줄을 추가했다.
- 커버한 요구사항: 메인 목록은 재원/재직만 표시, 비활성 대상은 통합 관리 메뉴로 분리, 전환 시 확인창 표시, 퇴원/퇴사 30일 보관 만료일 표시, 자동 archive 처리.

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/status-management.test.ts`, `src/lib/api/students.test.ts`, `src/lib/api/teachers.test.ts`, `src/app/status-management/page.test.tsx`, `tests/e2e/home.spec.ts`
- 시나리오: 보관 만료일 계산, 상태별 표시명, 메인 목록 active 필터, 휴원/퇴원 관리 목록 조회, 상태 변경 RPC payload, 통합 관리 탭 전환, AlertDialog 확인 흐름.
- 초기 실패: 새 도메인 모듈과 `/status-management` route가 없어 실패했고, 기존 API는 `status`와 `archived_at` 필터 및 `p_reason` payload를 갖지 않았다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run --reporter=dot` | 통과 | 58 files, 281 tests |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next typegen 및 `tsc --noEmit` |
| `pnpm build` | 통과 | `/status-management` static route 생성 확인 |
| `pnpm test:e2e` | 통과 | 9개 Playwright 테스트 통과 |
| `git diff --check` | 통과 | whitespace 오류 없음 |

## 브라우저 증거

- URL: `/status-management`
- 데스크톱 스크린샷: 이번 작업에서는 Playwright assertion 중심으로 검증했다.
- 모바일 스크린샷: 별도 캡처 없음.
- 비고: E2E에서 사이드바 `휴원/퇴원` 메뉴 이동, 원생/선생님 탭 전환, 상태 변경 `AlertDialog` 표시를 확인했다.

## Supabase 증거

- Migration: `20260825074309_status_management_soft_archive.sql`
- RLS 확인: `entity_status_transitions`에 RLS를 활성화하고 owner/desk select/insert 정책과 authenticated grant를 추가했다.
- 역할별 확인: `owner@lesson.local`로 REST 로그인 후 `academy_members` owner 권한 조회를 확인했다.
- 원격 검증: 임시 선생님 row를 생성해 `update_teacher_status` RPC로 퇴사 처리, `retention_until = 2026-09-24`, active 목록 제외, 감사 로그 생성, `archive_expired_people` RPC로 `archived_at`과 `archive_reason` 기록을 확인했다. 임시 row는 ID 기준으로 삭제 후 남지 않음을 확인했다.
- Supabase 명령: `supabase db push --linked`, `supabase db lint --linked --fail-on error`, `supabase migration list --linked`, `supabase db push --linked --dry-run`.

## 품질 정리

- 코드 단순화: 상태 목록의 표시명, 보관 만료일, 남은 일수 계산은 `src/domain/status-management.ts`로 분리했다.
- 재사용한 추상화: 기존 `ListView`, `queryKeys`, TanStack Query, shadcn `Tabs`, `Table`, `AlertDialog`, `Textarea`를 사용했다.
- 테스트 정리: 사용자 행동 중심의 role/text query를 유지했고, 버튼 접근성 이름은 대상 이름을 포함하도록 정리했다.
- 남은 부채: 원생 상태 변경 원격 검증은 수업 일정 취소 부작용이 있어 임시 원생 전체 fixture가 필요하다. 현재 원격 실제 RPC 검증은 선생님 상태 전환으로 수행했다.

## 위험과 확인 질문

- 위험: Supabase Cron은 `pg_cron` 기반이라 프로젝트 플랜/확장 설정에 따라 실행 권한 정책이 달라질 수 있다. migration 적용과 lint는 통과했다.
- 후속 질문: 없음.

## Git

- 커밋: 아직 하지 않음.
- push 여부: 하지 않음.
