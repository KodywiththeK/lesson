# 2026-08-24 원생 정기요일 수정 same-day series 종료 오류 수정

## 문제

- 원생 정보에서 정기요일을 수정할 때 다음 오류가 발생했다.
  - `new row for relation "lesson_series" violates check constraint "lesson_series_check1"`
- 원인은 `update_student_profile_from_date`가 기존 정기 series를 항상 `effective_until = 적용일 - 1`로 닫기 때문이었다.
- 기존 series의 `effective_from`이 적용일과 같거나 적용일보다 미래이면 `effective_until < effective_from`이 되어 check constraint를 위반했다.

## 수정

- 새 migration `20260824072637_fix_same_day_series_close.sql`을 추가했다.
- 기존 series 종료 로직을 다음 정책으로 바꿨다.
  - 기존 series가 적용일보다 과거에 시작했으면 `effective_until = 적용일 - 1`
  - 기존 series가 적용일과 같거나 이후에 시작했으면 `effective_until = effective_from`
  - 두 경우 모두 `active = false`
- 이로써 동일일 적용 수정에서도 기간 check constraint를 위반하지 않는다.

## 검증

- `pnpm test:run src/lib/supabase/schema-contract.test.ts src/lib/api/students.test.ts --reporter=dot`: 통과
- `pnpm lint`: 통과
- `pnpm typecheck`: 통과
- `supabase db push --dry-run --linked`: 적용 대상 migration 확인
- `supabase db push --linked --yes`: 원격 적용 완료
- `supabase db lint --linked --fail-on error`: `No schema errors found`
- `pnpm test:run --reporter=dot`: 56 files, 254 tests 통과
- `pnpm build`: 통과
- `supabase migration list --linked`: local/remote 모두 `20260824072637` 반영 확인

## 남은 참고

- 원격 DB에 변형 없는 transaction 테스트를 직접 실행할 수 있는 `psql`/query 도구가 없어 실제 원생 row를 임의 수정하는 검증은 하지 않았다.
- 함수 로직과 원격 schema lint 기준으로 constraint 위반 원인은 제거됐다.
