# 자율 에이전트 루프

하네스 루프는 다음 순서를 따른다.

```text
Discover -> Plan -> Red -> Green -> Refactor -> Verify -> Consolidate -> Evidence -> Commit
```

## Discover

- 관련 문서와 기존 코드를 먼저 읽는다.
- `docs/product/pdf-understanding.md`와 `docs/product/open-questions.md`를 확인한다.
- PDF 기반 요구사항은 텍스트 추출본과 렌더 이미지 노트를 함께 확인한다.
- Supabase 작업은 최신 Supabase 문서와 changelog를 확인한 뒤 진행한다.

## Plan

- 작업을 작은 phase로 나눈다.
- 작성할 테스트 파일과 시나리오를 먼저 이름 붙인다.
- 작업 완료를 증명할 검증 명령을 정한다.
- 제품 정책, 민감 권한, 계산 기준처럼 문서/코드에서 안전하게 추론할 수 없는 결정은 사용자에게 질문한다.

## Red

- 요구사항을 포착하는 가장 작은 실패 테스트를 작성한다.
- 실패가 setup 문제가 아니라 누락된 동작 때문인지 확인한다.
- 진행을 위해 기존 테스트를 약화하지 않는다.

## Green

- 실패 테스트가 요구하는 최소 구현만 한다.
- 회차권, 출석, 보강, 미납, 급여 같은 규칙은 가능한 한 UI 밖의 도메인 함수로 둔다.
- 현재 phase와 무관한 리팩터링은 미룬다.

## Refactor

- 이름, 경계, 중복, 데이터 흐름을 정리한다.
- 의미 있는 리팩터링마다 테스트가 계속 통과하는지 확인한다.

## Verify

- `docs/harness/verification-matrix.md`에 맞는 검증을 실행한다.
- UI 변경은 브라우저에서 데스크톱/모바일을 확인한다.
- Supabase 변경은 역할별 RLS와 접근 권한을 검증한다.

## Consolidate

- `docs/harness/quality-consolidation.md`를 적용한다.
- 개발 중 임시 테스트를 유지보수 가능한 회귀 테스트로 정리한다.
- 일회용 코드와 우연한 복잡성을 제거한다.

## Evidence

- `docs/harness/evidence-template.md` 또는 작업별 evidence 문서에 결과를 기록한다.
- 실행하지 못한 명령이 있으면 이유를 남긴다.

## Commit

- `docs/harness/git-workflow.md`의 컨벤션을 따른다.
- 검증된 논리적 작업 단위를 `main` 브랜치에 커밋한다.
- 사용자가 직접 push한다고 했으므로 원격 push는 사용자 지시가 있을 때만 수행한다.
