# 검증 매트릭스

변경에는 가장 작은 충분한 검증 세트를 적용하고, 공유 동작을 건드렸다면 더 넓은 검증으로 확장한다.

| 변경 표면 | 필수 확인 | 증거 |
| --- | --- | --- |
| 도메인 유틸 | Unit test, typecheck | 명령 결과 |
| React 컴포넌트 | Unit/component test, 접근성 중심 query | 명령 결과 |
| 페이지 또는 route | Component/integration test, browser smoke check | 명령 결과와 필요 시 스크린샷 |
| 핵심 사용자 흐름 | Playwright E2E | 실패 시 trace 또는 screenshot |
| 스타일/디자인 시스템 | 데스크톱/모바일 스크린샷, 겹침 확인 | 스크린샷 경로 |
| Supabase schema | migration dry-run/apply/list, linked lint, generated type | migration 출력과 type 생성 결과 |
| Supabase RLS | 역할별 접근 테스트 | 역할별 query 결과 |
| PDF ingestion | 텍스트 추출, 렌더 페이지 검토, 필요 시 OCR fallback | 추출 경로와 페이지 이미지 경로 |
| 빌드 설정 | lint, typecheck, build | 명령 결과 |
| Git 운영 | status, log, 커밋 메시지 컨벤션 | `git status`, `git log` |

## 기본 명령

앱 scaffold 이후 기본적으로 사용할 수 있는 명령은 다음과 같다.

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:run`
- `pnpm test:components`
- `pnpm test:e2e`
- `pnpm build`

## 브라우저 검증

시각적 또는 상호작용 UI 변경 시 다음을 확인한다.

- dev server를 실행한다.
- 데스크톱과 모바일 viewport를 확인한다.
- 텍스트 겹침이 없는지 확인한다.
- 버튼 크기가 안정적인지 확인한다.
- 주요 workflow에 접근 가능한지 확인한다.
- shadcn 컴포넌트가 semantic token과 접근 가능한 label을 사용하는지 확인한다.
