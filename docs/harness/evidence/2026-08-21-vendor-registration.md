# 2026-08-21 거래처 등록 증거

## 목표

PDF 3-4 거래처 등록 요구사항에 맞춰 거래처명, 연락처, 종류, 비고를 현재 학원 범위 안에서 기록하는 도메인 규칙을 구현한다.

## 출처 요구사항

- PDF 3-4: 거래처 등록은 거래처명, 연락처, 종류, 비고 기록
- `docs/product/traceability-matrix.md`
- `docs/product/acceptance-scenarios.md`

## 먼저 작성한 테스트

- 테스트 파일: `src/domain/vendor.test.ts`
- 시나리오:
  - 거래처명, 연락처, 종류, 비고 기록
  - 거래처명과 종류 필수 검증
- 초기 실패: `src/domain/vendor.ts`가 없어 테스트가 실패했다.

## 구현 내용

- `src/domain/vendor.ts`
  - `RegisterVendorInput`
  - `VendorRecord`
  - `registerVendor`
- `docs/product/acceptance-scenarios.md`
  - 거래처 등록 시나리오 추가
- `docs/product/traceability-matrix.md`
  - 거래처 등록 요구사항을 테스트와 구현 파일에 연결

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/domain/vendor.test.ts` | 통과 | unit 2개 테스트 통과 |
| `pnpm test:run` | 통과 | unit/component 101개 테스트 통과 |
| `pnpm lint` | 통과 | ESLint 오류 없음 |
| `pnpm typecheck` | 통과 | Next route typegen과 TypeScript 타입 오류 없음 |
| `pnpm build` | 통과 | Next.js production build 성공 |
| `pnpm test:e2e` | 통과 | production build 기반 Chromium E2E 1개 테스트 통과 |

## Quality Consolidation

- 거래처 등록은 단일 책임의 순수 함수로 유지했다.
- 화면에서 재사용될 필드명을 PDF 용어와 맞췄다.
- 입력 문자열은 trim해 저장하되, 연락처와 비고 형식은 운영 정책이 확정되기 전까지 과하게 제한하지 않았다.

## 남은 질문

- 거래처 종류를 자유 입력으로 둘지, 교재/악기/시설/기타 같은 선택지로 고정할지?
