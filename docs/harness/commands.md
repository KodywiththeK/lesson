# 명령어 기준

이 문서는 하네스가 사용하는 표준 명령어를 정의한다. 패키지 스크립트를 추가하거나 바꾸면 이 문서를 함께 갱신한다.

## 프로젝트

- `pnpm install`: `pnpm-lock.yaml` 기준으로 의존성을 설치한다.
- `pnpm dev`: 로컬 개발 서버를 실행한다.
- `pnpm build`: production build를 실행한다. 현재 환경에서는 Next 16 Turbopack 빌드가 내부 포트 바인딩 오류를 내므로 `next build --webpack` 경로를 사용한다.
- `pnpm lint`: ESLint로 소스 파일을 검사한다.
- `pnpm typecheck`: TypeScript 타입 검증을 실행한다.

## 테스트

- `pnpm test`: Vitest watch 모드로 unit/component 테스트를 실행한다.
- `pnpm test:run`: CI형 Vitest 단일 실행을 수행한다.
- `pnpm test:watch`: Vitest watch 모드를 명시적으로 실행한다.
- `pnpm test:components`: 컴포넌트 테스트 프로젝트만 실행한다.
- `pnpm test:e2e`: Playwright E2E를 실행한다. 기본 포트는 `127.0.0.1:3107`이다.
- `pnpm test:e2e:ui`: Playwright UI 모드로 디버깅한다.

## Supabase

- `supabase --help`: CLI 사용 전 현재 명령을 확인한다.
- `supabase login`: 원격 프로젝트에 CLI로 접근해야 할 때 로그인한다.
- `supabase link --project-ref <project-ref>`: 로컬 repo와 원격 Supabase 프로젝트를 연결한다.
- `supabase migration new <name>`: migration 파일을 만든다.
- `supabase db push --dry-run`: 적용 전 migration 영향을 확인한다.
- `supabase db push`: 사용자 승인 후 원격 DB에 migration을 적용한다.
- `supabase db reset --local --no-seed`: Docker 기반 로컬 DB에 migration을 처음부터 적용해 검증한다.
- `supabase db lint --local --fail-on error`: 로컬 DB schema lint를 실행한다.
- `supabase db advisors`: 사용 가능할 때 데이터베이스 advisor를 실행한다.

## PDF

- `pdfinfo <file>`: PDF 메타데이터와 페이지 수를 확인한다.
- `pdftotext -layout <file> <output.txt>`: 레이아웃을 보존해 텍스트를 추출한다.
- `pdftoppm -png <file> <prefix>`: PDF 페이지를 PNG로 렌더링한다.
- `pdfplumber`: 텍스트와 표 추출을 보조한다.
- `tesseract <image> <output> -l kor+eng`: 이미지 기반 텍스트 OCR fallback을 수행한다.

## Git

- `git status --short --branch`: 작업 전후 변경 상태를 확인한다.
- `git init -b main`: 저장소를 `main` 브랜치로 초기화한다.
- `git remote add origin git@github.com:KodywiththeK/lesson.git`: GitHub remote를 연결한다.
- `git add <path>`: 논리적 작업 단위에 맞는 파일을 stage한다.
- `git commit -m "<type>(<scope>): <summary>"`: 컨벤션에 맞춰 커밋한다.
- `git log --oneline --decorate -5`: 최근 커밋을 확인한다.

## 규칙

- 스크립트와 이 문서가 다르면 작업 완료로 보지 않는다.
- 파괴적 명령은 사용자가 명시적으로 승인한 경우에만 실행한다.
- 샌드박스 제한으로 실패한 명령은 같은 명령을 승인 권한으로 재실행하고, 결과를 증거에 남긴다.
