# 2026-08-20 한국어 문서 정리와 PDF 요구사항 정렬 증거

## 목표

사용자 확인에 따라 PDF 요구사항을 제대로 숙지한 상태인지 점검하고, 앞으로 작성/수정하는 문서는 한국어로 유지한다는 규칙에 맞춰 남은 영어 문서를 정리한다.

## 다시 확인한 PDF 산출물

- `docs/product/source-extracts/pdf-ingestion-report.md`
- `docs/product/source-extracts/pdf-image-notes.md`
- `docs/product/source-extracts/pdf-text.md`

## 확인한 핵심 내용

- PDF는 21페이지이며 텍스트 레이어와 예시 이미지를 함께 포함한다.
- 이미지는 필수 구현 자산이 아니라 UI 흐름 참고 자료다.
- 핵심 도메인 규칙은 “수업 일정 등록만으로 회차권을 차감하지 않고, 실제 출석 확인 시에만 1회 차감한다”이다.
- PDF는 더 클래식 음악학원 요구사항에서 출발하지만, 최신 사용자 지시에 따라 제품은 여러 음악학원이 가입하는 멀티테넌트 서비스로 설계한다.

## 변경한 문서

- `docs/product/functional-spec.md`: PDF 기반 기능명세를 한국어로 정리
- `docs/product/acceptance-scenarios.md`: 인수 시나리오를 한국어 TDD 기준으로 정리
- `docs/product/open-questions.md`: 확인 필요 정책을 멀티테넌트 서비스 관점으로 보강
- `docs/product/pdf-understanding.md`: PDF 숙지 노트 추가
- `docs/harness/README.md`: 하네스 개요 한국어 전환
- `docs/harness/agent-loop.md`: 자율 루프 한국어 전환
- `docs/harness/tdd-protocol.md`: TDD 기준 한국어 전환
- `docs/harness/quality-consolidation.md`: 품질 정리 기준 한국어 전환
- `docs/harness/goal-intake.md`: 목표 접수 템플릿 한국어 전환
- `docs/harness/phase-template.md`: phase 템플릿 한국어 전환
- `docs/harness/evidence-template.md`: evidence 템플릿 한국어 전환
- `docs/harness/verification-matrix.md`: 검증 매트릭스 한국어 전환
- `docs/harness/failure-policy.md`: 실패 대응 정책 한국어 전환
- `docs/engineering/security.md`: 보안/개인정보 기준 한국어 전환
- `docs/engineering/permissions.md`: 권한 설계 한국어 전환
- `docs/engineering/design-system.md`: 디자인 시스템 한국어 전환
- `docs/engineering/testing-strategy.md`: 테스트 전략 한국어 전환
- `docs/engineering/pdf-ingestion.md`: PDF 수집 절차 한국어 전환

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| 문서 영어 잔여 스캔 | 통과 | 주요 영어 지시문 패턴 없음 |
| `pnpm test:run` | 통과 | unit/component 14개 테스트 통과 |
| `pnpm lint` | 통과 | `eslint .` 기준 |
| `pnpm typecheck` | 통과 | `tsc --noEmit` 기준 |

## Quality Consolidation

- PDF 출처 요구사항과 최신 사용자 지시를 분리했다.
- 기능명세, 인수 시나리오, open questions, traceability가 같은 용어를 쓰도록 맞췄다.
- `TBD`, `Pending`, `Given/When/Then` 같은 영어 상태값을 한국어 기준으로 정리했다.

## 다음 작업

- 다음 개발 phase는 권한/멤버십 골격 또는 회차권 재등록/만료 규칙 중 하나로 시작할 수 있다.
- Supabase migration은 아직 만들지 않는다. 역할/RLS 정책을 구현하기 전에 사용자 확인이 필요한 권한 질문을 먼저 좁힌다.
