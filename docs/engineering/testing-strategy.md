# 테스트 전략

## 테스트 피라미드

- Unit: 도메인 규칙과 순수 유틸
- Component: 폼, 테이블, 필터, 다이얼로그, 표시 상태
- Integration: page workflow와 server action 경계
- E2E: 브라우저에서 핵심 사용자 여정

## 도구

- Vitest: unit/integration test
- React Testing Library: React component behavior
- Playwright: E2E와 브라우저 검증

## 원칙

- 테스트는 가능한 한 사용자 행동과 닮아야 한다.
- 접근 가능한 role, label, visible text를 우선한다.
- 컴포넌트 상호작용은 `user-event`를 사용한다.
- Playwright locator는 `getByRole`, `getByLabel`, `getByText`를 우선한다.
- 동작 테스트에 CSS selector를 남용하지 않는다.
- snapshot은 작고 안정적인 직렬화 출력에만 제한적으로 사용한다.

## Fixture

- 원생, 선생님, 회차권, 수업, 교재, ledger seed data는 결정적으로 만든다.
- 테스트는 격리되어야 한다.
- 각 E2E test는 자기 데이터 setup/cleanup을 통제해야 한다.
- 실제 테스트 Supabase 프로젝트가 준비되기 전까지는 local Supabase 또는 mock server boundary를 우선한다.

## 핵심 회귀 영역

- 출석 확인 시에만 회차권 차감
- 결석 시 회차권 미차감
- 보강/패스 처리와 메모 생성
- 개인레슨 선생님/시간 충돌
- 원생 등록이 일정과 고정 수입에 반영되는 흐름
- 교재 결제 완료가 ledger에 반영되는 흐름
- 급여 계산과 지급 ledger 생성
- 역할별 UI 표시와 Supabase RLS
- 학원 tenant 간 데이터 격리
- TanStack Query cache key tenant 격리

## 테스트 품질 정리

완료 전 다음을 확인한다.

- 개발 중 확인용 임시 테스트를 제거한다.
- 시나리오 이름을 비즈니스 언어로 바꾼다.
- 구현 세부사항에 과하게 맞춘 테스트를 보강한다.
- 실패 원인을 진단하기 충분할 만큼 집중된 회귀 테스트를 유지한다.
