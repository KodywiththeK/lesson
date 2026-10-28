# 개인레슨 악기 색상 대비 개선 증거

## 요약

- 목표: 직접 색상 선택으로 생긴 글자 대비 문제를 해결하고 악기색을 8개 기본 색으로 제한한다.
- 완료한 변경: 최종 사용자 요청에 따라 예정·등원 모두 흰 바탕에 같은 22% 악기색을 합성하고, 같은 계열의 진한 글자색으로 최소 7:1 대비를 보장했다. 달력·출석창은 일정 카드에, 일별 표는 악기 이름 태그에만 악기색을 적용한다. 직접 선택기를 제거하고 API 저장값을 제한했다.
- 연결된 요구사항: 2026-10-27 사용자 색상 대비 개선과 후속 악기 이름 태그 요청. 인수 시나리오는 `docs/product/acceptance-scenarios.md`의 악기 색상 항목에 반영했다.
- 기존 온보딩 작업 파일은 보존했다. 겹치는 제품 문서는 색상 관련 문장만 수정했다.

## 먼저 작성한 테스트

- `src/domain/instrument-color.test.ts`: 8개 색상의 예정·등원 동일 배경과 7:1 대비, 기존 직접 색의 가장 가까운 기본 색 해석. 첫 실행에서 어두운 기존 배경과 미구현 함수 때문에 실패했다.
- `src/lib/api/lesson-calendar-settings.test.ts`, `src/features/settings/lesson-schedule-settings-form.test.tsx`: 임의 색 저장 거부, 직접 선택기 제거와 연한 색 미리보기. 첫 실행에서 임의 색 저장·직접 선택기가 남아 실패했다.
- `src/features/lessons/private-day-attendance-dialog.test.tsx`, `src/features/lessons/private-lesson-day-view.test.tsx`, `src/features/lessons/lesson-month-calendar.test.tsx`: 출석 카드의 보조 문구 대비, 일별 표 악기 태그 범위, 달력 보조 글자의 투명도 제거. 첫 실행에서 보조 문구의 별도 회색, 행 전체 배경, 태그 부재, 달력 글자의 `opacity-80` 때문에 실패했다.
- `src/lib/supabase/instrument-color-palette-contract.test.ts`: 변환·제약 migration 파일의 팔레트 값과 순서. 파일 생성 전에 실패했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | 최종 변경 기준 |
| `pnpm typecheck` | 통과 | 최종 변경 기준 |
| `pnpm test:run` | 최종 검토 시 212파일, 2,189테스트 통과 | 현재 작업 트리 |
| `pnpm build`, `pnpm test:e2e tests/e2e/lesson-schedule-improvements.spec.ts` | 일반·데모 빌드 통과, 브라우저 4개 통과 | 데스크톱·모바일, 밝은·어두운 테마 |
| `git diff --check` | 통과 | 공백 오류 없음 |

## 브라우저 증거

- 데모 URL: `/lessons/private`, `/settings/lesson-schedule`.
- `test-results/lesson-schedule-improvements*`에 출석창 데스크톱 밝은·어두운 화면과 일별 표 모바일 밝은·어두운 화면 캡처가 있다. 캡처는 자동 생성 산출물이며 커밋 대상이 아니다.
- 일별 표에서 행 전체는 악기색을 쓰지 않고 악기 이름 태그만 연한 색을 쓴다. 모바일에서도 태그와 일반 행의 배경 차이를 확인했다.

## Supabase 증거

- 적용 파일: `supabase/migrations/20261027144305_instrument_color_palette.sql`. Supabase MCP로 원격 프로젝트 `zkzqmqtzzlgljkuctpbn`에 적용했고 원격 migration history 버전은 `20261027144305`다. 로컬 파일명도 이에 맞췄다.
- 연결된 원격 프로젝트의 `academy_instrument_colors`는 읽기 전용 조회에서 총 0건, 직접 선택 색 0건이었다.
- 원격 읽기 전용 SQL에서 변환 계산을 확인했다: `#236bb3`·`#246BB2` → `#246bb2`, `#f2c94c` → `#bc7325`.
- migration 계약 테스트가 TypeScript 팔레트와 SQL의 RGB 값·순서·제약 값을 대조한다. 기존 RLS·권한은 변경하지 않았다.
- 적용 후 원격 SQL에서 `academy_instrument_colors_palette_check` 제약 1개와 색상 설정 0건을 확인했다. 변환할 기존 행은 없었다.

## 품질 정리

- 가독성: 색상 선택, 합성, 대비 계산을 도메인 함수에 두고 화면은 반환된 스타일만 사용한다.
- 예측 가능성: 기존 색 변환은 RGB 제곱 거리로 결정하며 같은 거리는 팔레트 앞순서가 이긴다. API는 팔레트 밖 저장을 명시적으로 거부한다.
- 응집도: 색상 정책은 `instrument-color.ts`, 저장 검증은 설정 API, 화면 범위는 각 레슨 뷰에 둔다.
- 결합도: 테이블 전체 배경과 모바일 표 라벨 전역 CSS 변경을 제거했다. 출석창·달력 스타일은 공유 색상 계산을 사용한다.
- simplify 결과: 불필요한 타입 단언과 테이블 색상용 CSS 변수를 제거했고, 일별 표는 악기 태그만 스타일을 받도록 줄였다. 달력 보조 글자의 불필요한 투명도도 제거했다. 변경 후 전체 테스트·빌드·브라우저 검증을 다시 실행했다.
- 코드 품질 리뷰: Critical·Warning 없음.

## 위험과 Git

- 원격 DB 제약은 적용됐다. 실제 로그인 세션에서 색상 변경 저장은 수행하지 않았으며 UI와 API 계약 테스트, 브라우저 표시로 검증했다.
- push는 수행하지 않는다.
