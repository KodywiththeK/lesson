# CLAUDE.md

이 프로젝트의 공통 작업 규칙은 `AGENTS.md`가 SSOT다. Claude Code는 아래 import로 그대로 읽는다. 규칙은 `AGENTS.md` 한 곳에서만 고치고 이 파일에 복사하지 않는다.

@AGENTS.md

## Claude Code 작업 메모

`AGENTS.md`를 보완하는 Claude Code 전용 운영 메모다. 새로 정하는 정책이 아니라 이미 문서화된 흐름의 요약이다.

### 명령어

- 개발 서버: `pnpm dev`
- 검증: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`(단위·컴포넌트), `pnpm test:e2e`(데모 production build 후 Playwright)
- 전체 목록과 검증 기준은 `docs/harness/commands.md`, `docs/harness/verification-matrix.md`를 따른다.
- 시각 확인이 필요하면 `NEXT_PUBLIC_E2E_DEMO=1`로 빌드한 뒤 `next start`로 데모 데이터 화면을 연다. 변경 이력처럼 서비스 연결이 필요한 화면은 데모에서 볼 수 없으니 증거에 한계를 적는다.

### 질문 우선

- 제품 정책, 권한, UX 의사결정, 해석이 갈리는 요구는 추정하지 말고 `AskUserQuestion`으로 묻는다. 화면 요청이 코드의 현재 동작과 다르게 읽히면(예: 이름은 "일별"인데 실제는 월 목록) 먼저 확인한다.
- 사용자가 "하나하나 물어보면서"라고 한 작업은 단계마다 결과를 보여 주고 승인받은 뒤 다음으로 간다.

### UI 작업

- 디자인 토큰·셸·공용 부품의 SSOT는 `docs/engineering/design-system.md`다. 색과 크기는 `src/app/globals.css`의 토큰으로만 쓰고 `bg-green-600`, `text-[10px]` 같은 팔레트 색·임의값을 직접 쓰지 않는다.
- 카드·구획 제목·요약 값·빈 안내는 `src/components/shared/`(`SectionCard`, `SectionHeader`, `StatTile`, `EmptyState`)를 먼저 쓴다. 표 기본 모양은 `src/components/ui/table.tsx`가 정하므로 화면에서 `px-4 py-3` 같은 기본값을 다시 쓰지 않는다.
- 테스트는 role·접근 가능한 이름·`data-variant` 같은 동작 기준으로 쓴다. 클래스 문자열은 단언하지 않는다.
- 로직과 스타일이 섞인 변경은 로직 함수 본문이 그대로인지 diff로 확인한다.

### 커밋 전 흐름

1. 관련 테스트와 `pnpm lint`, `pnpm typecheck`, `pnpm test:run`(영향이 넓으면 `pnpm test:e2e`)을 통과시킨다.
2. `/simplify`를 실행해 재사용·단순화·효율·추상화 수준을 점검하고 고친 뒤 영향받은 테스트를 다시 돌린다. 절차는 `docs/engineering/code-quality.md`의 "마지막 simplify 필수 규칙"과 `docs/harness/git-workflow.md`를 따른다.
3. evidence(`docs/harness/evidence/`, 템플릿은 `docs/harness/evidence-template.md`)에 변경, 테스트·Red 확인, 검증 결과, `가독성`·`예측 가능성`·`응집도`·`결합도`·`simplify 결과`, 남은 위험을 한국어로 남긴다.
4. 커밋은 사용자가 요청할 때만 한다. 요청받으면 논리 단위로 나누고 `type(scope): 한국어 요약` 형식을 쓴다(`docs/harness/git-workflow.md`). 생성물, `.env*.local`, 원본 PDF, `test-results`는 stage하지 않는다.
