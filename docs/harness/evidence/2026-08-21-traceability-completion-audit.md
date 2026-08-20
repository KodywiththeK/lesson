# 2026-08-21 PDF 요구사항 추적 완료 감사

## 목표

PDF에서 추출해 `docs/product/traceability-matrix.md`에 등록한 요구사항이 모두 테스트와 구현 파일에 연결되었는지 확인한다.

## 감사 기준

- 추적표에 `미작성` 또는 `미구현` 상태가 남아 있지 않아야 한다.
- 새 기능은 TDD로 먼저 실패를 확인하고 구현해야 한다.
- 구현 후 전체 검증 게이트를 통과해야 한다.
- 민감정보나 정책 미확정 항목은 구현에서 보수적으로 처리하고 `docs/product/open-questions.md`에 남겨야 한다.

## 확인 결과

| 확인 | 결과 | 비고 |
| --- | --- | --- |
| `rg -n "미작성\|미구현" docs/product/traceability-matrix.md` | 통과 | 검색 결과 없음 |
| `pnpm test:run` | 통과 | unit/component 112개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |
| `git status --short` | 통과 | 감사 전 작업트리 clean |

## 완료된 마지막 요구사항 묶음

- 공통 목록 검색/필터/정렬
- 학원 수업 일별 출결, 삭제 사유, 결석 대기열
- 월별 메모 저장과 unread, 패널 초기화
- 개인레슨 등록 UI 모델과 검색 결과 표시
- 회차권 수동 수정 권한과 감사 이벤트
- 원생 목록 검색/필터
- 선생님/거래처 등록
- 교재 구매 목록 표시 모델
- 수동 입출입과 전체 수입 그래프 집계
- 월급제/시급제 급여 계산

## 남은 리스크

- 현재 완료는 PDF 추적표 기준의 도메인 규칙, 표시 모델, 기본 AppShell 구현 완료를 의미한다.
- 실제 화면 CRUD, Supabase persistence, RLS migration 확장, API route/server action 연결은 다음 phase에서 별도 TDD 루프로 진행해야 한다.
- 주민등록번호는 원문 저장 없이 `encryptedValueRef + maskedValue`만 기록하는 보수적 임시 모델이며, 실제 암호화/조회/audit 정책은 사용자 확인 후 확정해야 한다.
- Supabase local DB 검증은 Docker Desktop 미설치로 과거 phase에서 실행하지 못했다. DB 변경 phase에서는 Docker 또는 원격 dry-run 환경을 먼저 준비해야 한다.
