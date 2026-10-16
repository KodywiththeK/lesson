# 회차권 등록 이력·권한 보강 Evidence

## 요약

- 목표: 회차권 재등록을 원생·악기별 한 잔액으로 원자적으로 병합하고, 등록 건별 기간·수입을 보존한다.
- 완료한 변경: 등록 이력 테이블, 직접 쓰기 차단, 출결 유효기간·참조변경·삭제 가드, 담당 선생님 제한 조회, 등록 건별 수입 집계, 모바일 회차권 관리.
- 커버한 요구사항: `docs/product/functional-spec.md`의 회차권 관리, `docs/product/acceptance-scenarios.md`의 재등록·차감·권한 시나리오.

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/lesson-ticket.test.ts`, `src/domain/lesson-ticket-income.test.ts`, `src/lib/api/lesson-tickets.test.ts`, `src/lib/supabase/lesson-ticket-migration.test.ts`, `src/features/lesson-tickets/lesson-ticket-list-screen.test.tsx`.
- 시나리오: 기본 4회, 등록일 역전 거부, 등록별 수입, 0원·원장 누락 구분, 직접 쓰기 차단, 기간 공백, 출결 참조변경·삭제 차단.
- 초기 실패: 새 등록 이력·역할별 RPC가 없어 계약 테스트가 실패했다. 독립 SQL 리뷰에서 발견한 출결 참조변경과 삭제 우회도 각각 실패 테스트로 재현한 뒤 수정했다. 후속 만료일 보존 SQL 계약과 폼 안내도 각각 실패 테스트를 확인한 뒤 구현했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run --reporter=dot` | 85개 파일, 863개 테스트 통과 | 후속 만료일 수정까지 포함한 전체 회귀 |
| `pnpm test:e2e` | 16개 통과 | 320px 등록·수정, 출석·수납 포함 |
| `pnpm typecheck`, `pnpm lint`, `git diff --check` | 통과 | 최종 통합 검증 |
| `pnpm build` | 통과 | 일반 운영 빌드 |
| Supabase MCP 사전 점검 | 기존 회차권 4건, 중복·복원 불가 0건 | 운영 DB 읽기 전용 |
| Supabase MCP `apply_migration` | 성공 | `20261016090200` SQL 적용 2026-10-16 |
| Supabase MCP 사후 점검 | 이력 4건, 기존 잔액 4건과 일치; unique 1개, 트리거 2개, owner policy 1개 | 직접 grant/usage 쓰기·삭제 RPC 차단 확인 |
| CLI `migration repair`·`migration list` | 통과 | 임시 버전 제거, 로컬·원격 `20261016090200` 일치 |
| CLI `db push --dry-run`·`db push --yes` | 통과 | 만료일 보존 `20261016090300` 한 건만 운영 적용 |
| 원격 함수·이력 SQL 확인 | 통과 | 최종 만료일 계산·등록 이력 기록 확인, `90000`~`90300` 순서 일치 |

## 브라우저 증거

- URL: `/passes` (E2E demo).
- 데스크톱 스크린샷: `test-results/.../lesson-tickets-1024.png`.
- 모바일 스크린샷: `test-results/.../lesson-tickets-320.png`, `lesson-tickets-320-adjust.png`, `lesson-tickets-320-register.png`.
- 비고: 320px에서 수정·등록 버튼과 다이얼로그 저장 버튼 접근, 가로 넘침 없음.

## Supabase 증거

- Migration: `20261016090200_lesson_ticket_registration_history.sql` 적용 후 원격 임시 history `20261015224536`을 공식 CLI로 정렬했다. 이어 `20261016090300_preserve_lesson_ticket_expiry_on_reregistration.sql`을 적용했다. SQL 재적용 없이 로컬·원격 버전이 순서대로 일치한다.
- RLS 확인: 등록 이력 owner 조회 policy, grant 직접 INSERT/UPDATE/DELETE 거부, 새 등록 이력 직접 INSERT 거부, 민감 결제 컬럼 SELECT 거부.
- 역할별 확인: SQL 권한·정책·함수 본문은 확인했지만 격리 DB가 없어 원장/데스크/선생님 실제 세션별 쓰기·롤백 실행 검증은 미수행.
- 비고: security advisor의 공개 `SECURITY DEFINER` RPC 경고는 14건에서 15건으로 증가했다. 추가 함수는 인증·학원 역할 검사를 포함한다. [Supabase advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## 품질 정리

- 코드 단순화: 재등록 총액이 아닌 등록별 연결 원장을 수입 SSOT로 쓰고, 0원과 누락 원장을 분리했다.
- 재사용한 추상화: 기존 query key·도메인 순수 함수·API adapter·shadcn Table을 유지했다.
- 테스트 정리: SQL 문자열 계약에 출결 UPDATE-all·DELETE 가드를 보강했다.
- 가독성: 등록 이력과 잔액의 역할, 원장 연결의 의미를 타입·함수명으로 드러냈다.
- 예측 가능성: 취소 RPC는 실제 차감 복구 여부를 반환하고 UI도 그 결과만 알린다.
- 응집도: 회차권 기간·수입 계산을 도메인/API 경계에 모았다.
- 결합도: 화면은 결제 SQL이나 역할 검사를 직접 구현하지 않는다.
- simplify 결과: 중복 모바일 회차권 목록을 단일 반응형 표로 합쳤다.
- 코드 품질 리뷰: 독립 읽기 전용 SQL 리뷰에서 직접 출결 참조변경 우회를 발견해 해결했다. 후속 독립 에이전트 재검토는 사용량 제한으로 실행되지 않아 이전·새 RPC를 전체 diff로 직접 대조했고 만료일 계산과 이력 저장 두 변경만 확인했다.
- 남긴 Warning/Suggestion: 기존 양수 결제 3건에는 연결 원장이 없어 수입 화면에서 `원장 기록 없음`으로 표시한다. 임의 보정하지 않았다.
- 남은 부채: Docker 또는 격리 Supabase가 없어 역할별 DB 실행 테스트를 완료하지 못했다.

## 위험과 확인 질문

- 위험: 격리 DB가 없어 동시 등록과 역할별 쓰기·롤백을 실제 세션으로 실행하지 못했다. SQL 계약과 운영 스키마·함수 정의만 확인했다.
- 후속 질문: 전역 삭제·출석 정정 보관 정책은 `docs/product/open-questions.md`에 남겼다.

## Git

- 커밋: 사용자 요청에 따라 최종 검증 후 논리 단위로 진행.
- push 여부: 하지 않음.
