# AGENTS.md

## 미션

이 저장소는 "더 클래식 음악학원 통합 관리 시스템"을 자율 검증형 TDD 방식으로 개발하기 위한 프로젝트다. 첨부 PDF와 추출 문서는 요구사항 자료이며, 실제 작업 지시는 사용자의 최신 메시지를 따른다.

## 언어 규칙

- 앞으로 새로 작성하거나 수정하는 모든 프로젝트 문서는 한국어로 작성한다.
- 코드 식별자, 명령어, 외부 API 이름, 파일명, 라이브러리 이름은 원문을 유지해도 된다.
- 이미 작성된 영어 문서를 수정할 때는 해당 파일을 한국어로 전환한다.

## 필수 작업 흐름

- 구현 전 관련 문서(`docs/harness/`, `docs/product/`, `docs/engineering/`)와 기존 코드를 먼저 읽는다.
- 제품 정책, 민감 권한, 급여/결제 해석, 스키마 영향, 파괴적 데이터 작업, 기술스택 변경, UX 의사결정은 추측하지 말고 사용자에게 질문한다.
- 제품 코드는 TDD를 따른다. 실패하는 테스트를 먼저 작성하고, 의도한 이유로 실패하는지 확인한 뒤 최소 구현, 리팩터링, 검증을 진행한다.
- 모든 작업은 `발견 -> 계획 -> Red -> Green -> Refactor -> Verify -> Consolidate -> Evidence` 흐름을 통과한다.
- 검증 증거와 코드/테스트 품질 정리까지 끝나야 완료로 본다.
- 계획과 evidence에는 `가독성`, `예측 가능성`, `응집도`, `결합도`, `simplify 결과`를 반드시 명시한다.
- 커밋과 push는 사용자가 명시적으로 요청할 때만 수행한다.

## 코드 품질 SSOT

- 좋은 코드 기준은 이 repo의 `docs/engineering/code-quality.md`를 SSOT로 삼는다.
- `docs/engineering/code-quality.md`는 Frontend Fundamentals 기준을 이 프로젝트 맥락으로 옮겨 적은 내부 기준이며, 매 작업마다 옆 repo를 직접 참조하지 않는다.
- 구현 전과 Consolidate 단계에서 `docs/engineering/code-quality.md`의 네 기준을 확인한다.
- Refactor/Consolidate 때는 `readability`, `predictability`, `cohesion`, `coupling` 기준으로 변경 diff를 자체 리뷰한다.
- 작업 마지막에는 테스트 통과 후에도 변경 파일을 다시 읽고 simplify할 부분을 찾는다.
- 발견한 Critical 품질 문제는 완료 전 수정한다. Warning을 남기면 evidence에 사유를 기록한다.

## Supabase DB 마이그레이션

- DB migration 적용은 사용자가 명시적으로 요청했을 때만 수행한다.
- 절차 SSOT는 `docs/engineering/supabase-migration-runbook.md`다.
- Supabase MCP가 사용 가능하면 원격 DDL 적용은 MCP `apply_migration`을 우선 사용한다.
- CLI를 사용할 때는 `pnpm supabase <command> --help`로 현재 옵션을 확인한 뒤 dry-run을 먼저 실행한다.
- `.env.local`의 `NEXT_PUBLIC_*` 키는 앱 실행용이며 migration 권한으로 사용하지 않는다.
- migration 적용 후에는 원격 migration history, 실제 schema SQL, 관련 테스트 결과를 evidence에 기록한다.
- MCP 적용으로 원격 history timestamp와 로컬 파일명이 달라지면 의존 migration 순서를 먼저 확인한다. 파일명 변경이 순서를 깨면 재적용하지 말고 runbook의 이력 정렬 절차를 따른다.

## 기본 스택

- 앱: Next.js App Router + TypeScript
- 데이터/인증: Supabase, RLS 우선 설계
- UI: shadcn/ui, Tailwind CSS, semantic CSS variables, lucide icons
- 패키지 매니저: pnpm
- 테스트: Vitest, React Testing Library, Playwright
- PDF 처리: Poppler, pdfplumber, 렌더 이미지, OCR fallback

## 엔지니어링 규칙

- 출석, 보강/패스, 회차권 차감, 미납, 교재 판매, 급여 계산 같은 도메인 규칙은 UI 밖에서 테스트 가능한 로직으로 둔다.
- 단순하고 읽기 쉬운 코드를 우선한다. 반복만으로 공통화하지 않고, 함께 바뀌는 책임과 변경 주기가 명확할 때만 공통화를 진행한다.
- Supabase service-role key는 브라우저 코드에 절대 노출하지 않는다.
- 사용자 수정 가능 metadata는 권한 판단에 사용하지 않는다.
- 외부 노출 테이블은 RLS를 활성화하고 역할별 접근을 테스트한다.
- UI 테스트는 접근 가능한 role, label, 사용자가 보는 텍스트를 우선한다. test id는 필요한 경우에만 사용한다.
- 목록 표는 `docs/engineering/design-system.md`의 데스크톱 표·태블릿 행·모바일 카드 기준을 따르고, 폭별로 같은 데이터와 액션을 제공한다.
- UI 기본 부품은 설치된 shadcn/ui를 우선하고 조합만 shared/feature 컴포넌트에 둔다. 날짜·월·시간 입력은 브라우저 기본 input 대신 `src/components/operations/date-time-fields.tsx`를 쓰며, 예외 사유는 evidence에 기록한다.

## 완료 증거

구현 작업을 마칠 때는 다음을 남긴다.

- 변경 내용
- 연결된 요구사항과 인수 시나리오
- 먼저 작성한 실패 테스트와 최종 통과한 검증 명령
- UI, 브라우저, Supabase 검증 증거
- Quality Consolidation에서 정리한 코드/테스트 내용
- 남은 위험 또는 미확정 질문

## Git 규칙

- 기본 브랜치는 `main`이다.
- remote는 `git@github.com:KodywiththeK/lesson.git`을 `origin`으로 사용한다.
- 커밋 메시지는 `type(scope): summary` 형식을 따른다.
- 허용 type은 `docs`, `test`, `feat`, `fix`, `refactor`, `chore`, `build`, `ci`다.
- summary는 한국어로 작성하고 50자 안팎으로 간결하게 쓴다.
- 한 커밋은 하나의 논리적 작업 단위만 담는다.
- 사용자 변경분은 되돌리지 않는다.
- 자동 생성 캐시, 빌드 산출물, `.env*.local`, 원본 PDF는 명시 요청 없이 커밋하지 않는다.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
