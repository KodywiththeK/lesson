# 하네스 개요

이 하네스는 사용자가 목표만 주면 Codex가 요구사항 발견, 계획, TDD, 구현, 검증, 품질 정리, 증거 기록까지 최소한의 사람 개입으로 진행하도록 돕는 문서 구조다. 문서가 작업 루프, 검증 게이트, 증거 형식, 질문 기준을 정의한다.

## 표준 흐름

1. **Discover**: 관련 제품/엔지니어링/하네스 문서를 읽고 기존 코드를 확인한다.
2. **Plan**: 목표를 phase로 나누고 성공 기준과 검증 명령을 정한다.
3. **Red**: 의도한 동작을 표현하는 실패 테스트를 먼저 작성하고, 예상한 이유로 실패하는지 확인한다.
4. **Green**: 테스트를 통과시키는 최소 구현을 한다.
5. **Refactor**: 테스트를 유지한 채 구조와 이름, 경계를 정리한다.
6. **Verify**: 변경 범위에 맞는 검증 매트릭스를 실행한다.
7. **Consolidate**: 코드와 테스트를 장기 유지보수 기준으로 다시 검토한다.
8. **Evidence**: 실행 명령, 결과, 스크린샷, DB 검증, 남은 위험을 기록한다.
9. **Commit**: 검증된 작업 단위를 `main` 브랜치에 커밋한다.

## 기본 읽기 순서

1. `AGENTS.md`
2. `docs/product/pdf-understanding.md`
3. `docs/harness/goal-intake.md`
4. `docs/product/product-brief.md`
5. `docs/product/functional-spec.md`
6. `docs/product/open-questions.md`
7. 관련 `docs/engineering/` 문서
8. 관련 코드와 테스트

## 작업 산출물

- 목표가 여러 phase로 나뉘면 `docs/harness/phase-template.md`를 사용한다.
- 장기 기술 결정은 `docs/harness/decision-log.md`에 기록한다.
- 작업이 길거나 검증 증거가 많으면 `docs/harness/evidence/`에 evidence 문서를 남긴다.
- Git 운영은 `docs/harness/git-workflow.md`를 따른다.

## 사람에게 질문해야 하는 경계

Codex는 문서화된 아키텍처 안에서 일반 구현 세부사항을 스스로 결정한다. 다만 다음은 반드시 사용자에게 확인한다.

- 제품 정책
- 민감 권한과 개인정보 처리
- 급여/결제 계산 해석
- 실제 데이터에 영향을 주는 파괴적 작업
- 실제 Supabase migration 적용
- 합의된 기술스택 변경
