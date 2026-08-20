# 2026-08-20 역할별 권한 도메인 증거

## 목표

PDF의 역할 기반 로그인 요구사항과 멀티테넌트 서비스 방향에 맞춰 앱 레벨 권한 판단 계약을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/pdf-understanding.md`의 역할 기반 로그인
- `docs/product/functional-spec.md`의 거래처/수입 관리 권한
- `docs/engineering/permissions.md`
- `docs/product/traceability-matrix.md`
- Supabase tenant/RLS migration의 owner/desk/teacher 정책

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/permissions.test.ts`
- 시나리오:
  - 활성 학원 멤버십을 세션 역할로 해석
  - 비활성 또는 다른 학원 멤버십은 anonymous 처리
  - owner는 전체 운영 기능 접근 허용
  - desk는 일상 운영 기능 허용, 재무는 기본 차단
  - desk 재무 권한은 명시 flag가 있을 때만 허용
  - teacher는 배정 원생과 본인 급여만 접근
  - teacher는 거래처와 수입 관리 메뉴 숨김
  - anonymous는 운영 기능 접근 거부
- 초기 실패: `permissions` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/permissions.ts`
  - `resolveSessionRole`
  - `canAccessFeature`
  - `getVisibleNavigationItems`
  - owner/desk/teacher/anonymous 역할 타입
  - 기능 key와 권한 flag

## 정책 처리

- 데스크 직원의 재무 접근은 PDF와 open question에서 미확정이므로 기본 차단했다.
- `allowDeskFinance` flag를 둬 이후 사용자 결정이 내려지면 학원별 설정으로 열 수 있게 했다.
- 권한 함수는 UI visibility와 서버 액션의 사전 차단에 사용하고, 최종 데이터 보호는 Supabase RLS가 담당한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/permissions.test.ts` | 통과 | unit 8개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 69개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 역할 문자열과 feature key를 도메인 타입으로 고정해 UI와 서버 코드가 같은 용어를 쓰게 했다.
- 선생님 권한은 전체 원생 접근이 아니라 `assignedStudentIds` 기반으로 제한했다.
- navigation visibility는 접근 가능 feature의 파생값으로 만들어 중복된 메뉴 권한 테이블을 피했다.

## 남은 질문

- 데스크 직원에게 수입 관리 또는 수동 입출입 권한을 줄지?
- 선생님이 출석/보강 액션을 직접 수행할 수 있는 범위는 어디까지인지?
- 선생님에게 원생 보호자 연락처를 노출할지?
