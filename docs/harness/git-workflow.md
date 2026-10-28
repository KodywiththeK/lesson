# Git 워크플로

## 기본 원칙

- 이 저장소는 `main` 브랜치에 직접 커밋한다.
- remote `origin`은 `git@github.com:KodywiththeK/lesson.git`이다.
- 사용자가 커밋을 요청한 작업 단위는 검증을 마친 뒤 커밋한다.
- 커밋에는 하나의 논리적 변경만 담는다.
- 사용자가 만든 변경은 되돌리지 않는다.

## 커밋 메시지 컨벤션

형식:

```text
type(scope): summary
```

예시:

```text
docs(harness): Git 워크플로 기준 추가
feat(ticket): 출석 기반 회차권 차감 규칙 추가
test(ticket): 회차권 중복 차감 방지 테스트 추가
chore(git): 저장소 초기화와 remote 연결
```

## 허용 type

- `docs`: 문서 변경
- `test`: 테스트 추가 또는 수정
- `feat`: 사용자에게 보이는 기능 추가
- `fix`: 버그 수정
- `refactor`: 동작 변경 없는 구조 개선
- `chore`: 도구, 설정, 관리 작업
- `build`: 빌드/패키지 설정 변경
- `ci`: 자동화/검증 파이프라인 변경

## scope 기준

- `harness`: 에이전트 루프, 검증, 문서 하네스
- `product`: 제품 요구사항과 정책 문서
- `architecture`: 구조, 데이터 모델, 권한 설계
- `ui`: 화면과 shadcn 기반 컴포넌트
- `api`: TanStack Query, API key, 데이터 요청 경계
- `supabase`: Supabase client, migration, RLS
- `ticket`: 회차권 도메인
- `git`: 저장소/remote/커밋 운영

## 커밋 전 체크리스트

1. `git status --short --branch`로 변경 파일을 확인한다.
2. 요구사항 충족, 누락·엣지케이스·사이드이펙트, 관련 권한·반응형과 기존 변경 보존을 확인한다. 가능한 경우 기능·데이터, UI·반응형, simplify 역할의 독립 에이전트에 병렬 검토를 맡긴다.
3. 관련 테스트와 변경 위험에 맞는 lint·typecheck·빌드·브라우저 및 DB 검증을 실행한다. 확인된 문제를 고친 뒤 영향받은 검증을 다시 실행한다.
4. [code-quality.md](../engineering/code-quality.md)의 "마지막 simplify 필수 규칙"에 따라 재사용·단순화·효율·추상화 수준을 점검한다. 에이전트나 Claude Code의 `/simplify`를 사용할 수 없으면 직접 검토하고 사유를 기록한다.
5. evidence 문서 또는 최종 보고에 실행 명령과 결과, simplify 결과를 남긴다.
6. 생성물과 비밀 파일이 stage되지 않았는지 확인한다.
7. 변경이 여러 논리 단위로 섞여 있으면 단위별로 나눠 컨벤션에 맞춰 커밋한다.

## 커밋하지 않는 파일

- `.env*.local`
- `node_modules`
- `.next`
- `test-results`
- `playwright-report`
- `*.tsbuildinfo`
- 원본 PDF 파일

## Push 기준

- 사용자가 push를 요청하거나 원격 반영이 필요한 시점에 `git push origin main`을 실행한다.
- SSH 인증 또는 네트워크 문제로 실패하면 결과를 보고하고 다음 조치를 사용자에게 확인한다.
