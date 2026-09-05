# 2026-09-05 인원·거래처 메뉴와 코드 품질 SSOT 증거

## 요약

- 목표: 원생, 선생님, 휴원/퇴원, 거래처 메뉴를 `인원·거래처` 상위 메뉴로 묶고 코드 품질 기준을 repo 내부 SSOT로 문서화한다.
- 완료한 변경: `/management/*` 하위 route, legacy redirect, 그룹형 navigation, 반응형 메뉴 렌더링, 내부 코드 품질 기준 문서를 추가했다.
- 커버한 요구사항: `docs/product/functional-spec.md`의 인원·거래처 관리, `docs/engineering/code-quality.md`의 가독성/예측 가능성/응집도/결합도 기준.

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/navigation.test.ts`, `src/app/app-shell.test.tsx`, `src/app/page.test.tsx`, `src/app/management/*/page.test.tsx`, `tests/e2e/home.spec.ts`
- 시나리오: 최상위 `인원·거래처` 메뉴와 하위 메뉴 4개, 역할별 하위 메뉴 노출, 새 `/management/*` 경로 이동, legacy route 유지.
- 초기 실패: `/management/*/page.tsx`가 없어 import가 실패했고, 기존 navigation은 `원생`, `선생님`, `휴원/퇴원`, `거래처`를 최상위 메뉴로 노출했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/navigation.test.ts src/domain/permissions.test.ts src/app/app-shell.test.tsx src/app/page.test.tsx src/app/management/students/page.test.tsx src/app/management/teachers/page.test.tsx src/app/management/status/page.test.tsx src/app/management/vendors/page.test.tsx --reporter=dot` | 통과 | 8개 파일, 25개 테스트 |
| `pnpm build` | 통과 | `/management/*`와 legacy route 정적 생성 확인 |
| `pnpm test:e2e` | 통과 | 9개 Playwright 시나리오 |
| `pnpm lint` | 통과 | ESLint 경고 없음 |
| 품질 정리 후 관련 테스트 재실행 | 통과 | 8개 파일, 25개 테스트 |

## 브라우저 증거

- URL: `/`, `/management/students`, `/management/teachers`, `/management/status`, `/management/vendors`
- 데스크톱 스크린샷: 미첨부
- 모바일 스크린샷: 미첨부
- 비고: Playwright에서 홈 메뉴 클릭 후 네 하위 route 이동과 주요 화면 heading/searchbox/dialog 흐름을 확인했다.

## Supabase 증거

- Migration: 없음
- RLS 확인: 변경 없음
- 역할별 확인: AppShell component test에서 owner/teacher 메뉴 노출을 확인했다.
- 비고: 이번 작업은 route/navigation/docs 변경이며 DB schema 영향은 없다.

## 품질 정리

- 코드 단순화: `href -> feature` 별도 매핑을 제거하고 navigation 모델의 `feature`를 기준으로 권한 필터를 적용했다.
- 재사용한 추상화: `NavigationEntry`, `NavigationLink`, `getVisibleNavigation`으로 렌더링과 표시 조건을 분리했다.
- 테스트 정리: 새 route 경로와 사용자-visible 메뉴명을 기준으로 page/E2E 테스트를 갱신했다.
- 코드 품질 리뷰: Critical 없음. Warning 없음. Suggestion 없음.
- 남긴 Warning/Suggestion: 없음
- 남은 부채: 스크린샷 기반 모바일 시각 검증은 별도 브라우저 QA에서 보강 가능하다.

## 위험과 확인 질문

- 위험: 상위 메뉴 `인원·거래처`와 하위 `거래처`가 부분 일치하므로 E2E에서는 정확한 이름 매칭이 필요하다.
- 후속 질문: 없음

## Git

- 커밋: 예정
- push 여부: 미수행
