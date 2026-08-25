# 2026-08-25 선생님 관리 확장 증거

## 변경 내용

- 선생님 등록/수정 입력을 계약기간, 출근 요일별 선택 시간, 급여 상세 입력까지 확장했다.
- 선생님 목록에 상태, 계약기간, 근무시간, 급여 요약, 자세히보기 버튼을 추가했다.
- 상세 다이얼로그에서 기본정보/계약/근무/급여를 확인하고 수정, 휴직, 퇴사, 퇴사자 삭제를 실행할 수 있게 했다.
- Supabase에 `teachers` 상태/계약 컬럼, `teacher_work_schedules` 테이블, 등록/수정/상태변경/삭제 RPC를 추가하고 원격 DB에 적용했다.
- 데모 상태도 동일한 선생님 등록/수정/상태/삭제 흐름을 지원하도록 확장했다.

## 연결 요구사항

- 선생님 등록 시 계약기간을 필수로 관리한다.
- 선생님별 출근 요일과 요일별 근무 시작/종료 시간을 선택 입력으로 관리한다.
- 급여 형태별로 월급, 시급, 비율제 상세값을 저장한다.
- 비율제는 `학원 몫 : 선생님 몫 = 합계 10`으로 입력하고 DB에는 선생님 몫 퍼센트로 저장한다.
- 선생님 목록에서 재직/휴직/퇴사 상태를 관리하고 필터링한다.
- 각 선생님은 상세보기, 정보 수정, 퇴사자 삭제를 제공한다.

## Red

- `src/domain/teacher.test.ts`: 계약기간, 급여 형태별 필수값, 비율제 변환, 근무시간 pair 검증 실패 테스트를 먼저 작성했다.
- `src/domain/teacher-list.test.ts`: 상태 필터와 상태 표시명 테스트를 먼저 작성했다.
- `src/lib/api/teachers.test.ts`: 목록 관계 select와 등록/수정/상태변경/삭제 RPC payload 테스트를 먼저 작성했다.
- `src/features/teachers/teacher-list-screen.test.tsx`: 상태/계약/근무/급여 표시, 등록 모달, 상세 다이얼로그 정책 테스트를 먼저 작성했다.

## Green / Refactor

- 도메인 급여 변환 규칙을 `buildTeacherSalarySetting`으로 분리했다.
- 근무시간 입력 검증을 `normalizeWorkSchedules`로 분리해 API와 UI snapshot 갱신에서 재사용했다.
- API 직접 insert를 RPC 호출로 변경해 선생님, 급여 설정, 근무 스케줄 저장을 DB transaction으로 묶었다.
- 화면은 shadcn/ui `Dialog`, `Table`, `Badge`, `Checkbox`, `Button`, `Input`, `NativeSelect`를 조합해 구현했다.
- 완료 전 상세 정보 마크업과 등록일 기본값, 수정 직후 상세 snapshot 갱신을 정리했다.

## Verify

- `pnpm test:run src/domain/teacher.test.ts src/domain/teacher-list.test.ts src/lib/api/teachers.test.ts --reporter=dot`: 통과
- `pnpm test:run src/lib/supabase/schema-contract.test.ts src/domain/teacher.test.ts src/domain/teacher-list.test.ts src/lib/api/teachers.test.ts --reporter=dot`: 통과
- `pnpm test:run src/features/teachers/teacher-list-screen.test.tsx src/app/teachers/page.test.tsx --reporter=dot`: 통과
- `pnpm test:run --reporter=dot`: 56 files, 272 tests 통과
- `pnpm lint`: 통과
- `pnpm typecheck`: 통과
- `pnpm build`: 통과
- `pnpm test:e2e`: 8 tests 통과
- `supabase db push --linked --dry-run`: 적용 전 `20260825070453_expand_teacher_management.sql` 확인
- `supabase db push --linked`: 원격 적용 완료
- `supabase db lint --linked --fail-on error`: No schema errors found
- `supabase migration list --linked`: `20260825070453`까지 local/remote 일치
- Supabase REST 원격 검증: 테스트 선생님 등록, 수정, 퇴사 처리, 삭제 후 `deleted: true` 확인

## 남은 리스크

- 현재 로컬 Node.js 20에서는 `@supabase/supabase-js`가 Node 22 권장 경고를 출력한다. 빌드와 앱 검증은 통과했지만, CLI/스크립트 기반 검증은 Node 22로 올리면 더 안정적이다.
- 급여 설정 테이블은 기존 owner-only RLS를 유지했다. 데스크 직원에게 급여 열람/수정 권한을 줄지 여부는 별도 제품 정책으로 확정해야 한다.
