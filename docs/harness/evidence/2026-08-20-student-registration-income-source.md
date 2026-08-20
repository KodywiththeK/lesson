# 2026-08-20 원생 등록과 고정 수입 기준 증거

## 목표

PDF 3-1의 원생 등록 요구사항 중 “악기별 담당 선생님/수업 형태/요일/진도/수강료/할인/최종 수강료 등록”과 “반복 일정 및 학원 고정 수입 기준 생성” 규칙을 TDD로 구현한다.

## 출처 요구사항

- `docs/product/functional-spec.md`의 `원생`, `가격표와 할인`, `학원 고정 수입` 섹션
- `docs/product/acceptance-scenarios.md`의 `원생 등록` 섹션
- `docs/product/traceability-matrix.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/student-registration.test.ts`
- 시나리오:
  - 원생 기본 정보와 악기별 수강 설정 생성
  - 학원 수업 수강 설정을 반복 일정 source로 생성
  - 최종 수강료가 있는 학원 수업을 고정 수입 source로 생성
  - 레슨비와 할인 합계가 최종 수강료와 다르면 등록 거부
  - 학원 수업에 요일 또는 시간이 없으면 등록 거부
- 초기 실패: `student-registration` 도메인 모듈이 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/student-registration.ts`
  - `registerStudent`
  - 원생 기본 record
  - 악기별 수강 설정
  - 반복 일정 source
  - 고정 수입 source

## 정책 처리

- PDF의 가격표 예시 금액은 기본 정책으로 하드코딩하지 않았다.
- 학원마다 가격표가 다를 수 있으므로 입력된 `lessonFee`, `discounts`, `finalMonthlyFee`의 산술 일관성만 검증했다.
- 개인레슨은 회차권 기반이므로 월 고정 수입 source에서 제외했다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/student-registration.test.ts` | 통과 | unit 5개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 45개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 원생 등록 결과를 `student`, `enrollments`, `scheduleSources`, `fixedIncomeSources`로 분리해 이후 Supabase transaction 저장에 대응할 수 있게 했다.
- 반복 일정 생성 phase에서 만든 `AcademyLessonEnrollment` 타입을 재사용해 일정 도메인과 등록 도메인 용어를 맞췄다.
- 고정 수입은 `effectiveFrom` 월을 포함해 월별 snapshot phase에서 이어받을 수 있게 했다.

## 남은 질문

- 학원별 가격표를 어디에서 설정하고 어떤 권한만 수정할 수 있는지?
- 소개 할인은 “해당 월 1회”로 명시되어 있는데, 자동 만료를 어떻게 표현할지?
- 개인레슨 회차권 구매 금액을 고정 수입과 별도 ledger로 볼지?
