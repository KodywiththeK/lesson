# 2026-08-21 선생님 등록 증거

## 목표

PDF 3-2 선생님 등록 요구사항에 맞춰 담당 파트, 연락처, 등록일, 주민등록번호, 급여 형태를 기록하는 도메인 규칙을 구현한다.

## 출처 요구사항

- PDF 3-2: 선생님 등록은 담당 파트, 연락처, 등록일, 주민등록번호, 급여 형태 기록
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`
- `docs/product/open-questions.md`의 민감정보 정책 질문

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/teacher.test.ts`
- 시나리오:
  - 담당 파트, 연락처, 등록일, 주민등록번호 보안 참조, 급여 형태 기록
  - 선생님명, 담당 파트, 연락처, 주민등록번호 보안 참조와 마스킹 값 필수 검증
  - 지원하지 않는 급여 형태 차단
- 초기 실패: `src/domain/teacher.ts`가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/teacher.ts`
  - `TeacherPayType`
  - `SecureResidentRegistrationNumberRef`
  - `RegisterTeacherInput`
  - `TeacherRecord`
  - `registerTeacher`
- `docs/product/acceptance-scenarios.md`
  - 선생님 등록 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 선생님 등록 요구사항을 테스트와 구현 파일에 연결
- `docs/product/open-questions.md`
  - 주민등록번호 원문 저장 금지 임시 모델과 추후 확정 질문 기록

## 정책 처리

- 주민등록번호는 민감정보이므로 답변 전 보수적 임시 모델을 적용했다.
- 도메인 기록에는 원문 주민등록번호를 남기지 않고 `encryptedValueRef`와 `maskedValue`만 남긴다.
- 실제 암호화 방식, 조회 권한, 보관/삭제/audit 정책은 Supabase 저장 phase 전에 최종 확정해야 한다.

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/teacher.test.ts` | 통과 | unit 3개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 112개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |
| `rg -n "미작성\|미구현" docs/product/traceability-matrix.md` | 통과 | 남은 미작성/미구현 항목 없음 |

## Quality Consolidation

- 선생님 등록과 급여 계산을 분리해 등록 도메인은 필드 기록과 필수값 검증만 담당한다.
- 급여 형태는 기존 급여 계산 도메인의 `ratio | monthly | hourly`와 같은 용어로 맞췄다.
- 민감정보 필드는 원문을 받지 않는 타입으로 만들어 accidental persistence 가능성을 줄였다.

## 남은 질문

- 주민등록번호를 실제로 저장할지?
- 저장한다면 암호화 방식, 조회 권한, 마스킹/보관/삭제/audit 정책을 어떻게 둘지?
