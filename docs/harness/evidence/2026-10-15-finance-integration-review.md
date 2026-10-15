# 수입 관리 연동·품질 검토 (2026-10-15)

## 요약

- 목표: 원생 등록, 출석, 회차권, 교재, 급여, 원장의 연결과 수입 관리 UI를 검토하고 발견한 오류를 수정한다.
- 확정 정책: 학원레슨 등록은 선생님과 모든 선택 요일의 시작·종료 시간이 필수다. 월수강료 생성 행은 이후 원생 변경으로 덮어쓰지 않는다. 재무 쓰기는 owner만 허용한다. 교재 결제 완료는 출고 등록 시에만 선택한다. 과거 완납 행의 원장 누락은 수납 상태를 신뢰해 보정한다.
- 변경: 등록 검증 공통화, 현재 날짜 기본값, 월별 미납인원, 급여 지급 기록 조회, 교재 출고·원장 단일 RPC, 원장 누락 보정, finance 쿼리 갱신, 좁은 화면 레슨수입 목록.

## 연결 확인

| 시나리오 | 확인 결과 |
| --- | --- |
| 원생 등록 → 학원 반복 일정 | 선생님과 모든 요일 시간이 없으면 UI·API·도메인에서 등록 거부. 원격 활성 학원 수강 중 반복 일정이 없는 건수 0. |
| 원생 등록 → 월수강료·미납 | 월 항목 생성은 등록일을 기준으로 하며 기존 행은 `ON CONFLICT DO NOTHING`으로 보존. 미납인원은 같은 원생의 여러 수강 항목을 1명으로 집계. 조회 실패 시 임시 ID로 수납하지 않음. |
| 개인레슨 출석 → 회차권 | 기존 원자적 `mark_private_lesson_attendance` RPC와 중복 차감 방지 경로 확인. 출석 성공 시 회차권 쿼리 무효화 유지. |
| 학원레슨 출석 → 비율제 급여 | 완료 출석·보강만 계산하는 도메인 로직 확인. 출석 저장·초기화 후 finance 쿼리 무효화 추가. 이미 지급한 급여는 저장된 정산 행으로 표시. |
| 교재 결제 완료 → 교재내역·원장 | `register_book_release` invoker RPC 한 번에 책·출고·원장 수입을 기록. 원장 실패 시 전체 트랜잭션 롤백. 결제 대기는 원장 수입을 만들지 않음. |
| 급여 지급 → 원장 지출 | 지급 RPC의 급여 지출 기록과 연결 FK, 지급된 정산 조회·표시 확인. 원격 지급 급여 중 원장 연결 누락 0. |

## Red → Green

- 등록 검증: 선생님/시간 없이 RPC가 호출되거나 UI가 저장 가능하던 테스트를 실패시킨 뒤 공통 도메인 검증 적용.
- 교재 등록: 단일 RPC 계약 테스트가 기존의 분리 insert에서 실패한 뒤 API·DB 함수를 교체.
- 원장 보정: 원천 ID 중복 방지와 수강료 `paid_ledger_entry_id` 연결 계약 테스트 실패 후 migration 추가.
- UI: 현재 월, 급여 지급 이력, 조회 실패, 미납인원, 모바일 수납 버튼 및 가로 넘침을 테스트로 고정.
- 기존 날짜 고정 테스트는 테스트 시계만 고정하고 운영 코드의 현재 월 동작은 유지.

## 원격 Supabase 증거

- 프로젝트: `zkzqmqtzzlgljkuctpbn`.
- 적용·history 일치: `20261015081610_restrict_finance_owner_and_preserve_snapshots`, `20261015082645_atomic_book_release`, `20261015084242_backfill_paid_finance_links`.
- 원격 SQL: 원장 select/insert/update/delete는 owner-only RLS와 owner 확인 trigger가 적용됨. 월수강료 생성은 기존 행을 변경하지 않음. 교재 등록 함수는 `SECURITY INVOKER`이고 출고·원장 insert를 모두 포함함.
- 보정 전/후: 결제 완료 교재의 원장 연결 누락 `1 → 0`, 완납 수강료의 원장 연결 누락 `1 → 0`. 지급 급여 원장 누락 `0`, 활성 학원 수강의 반복 일정 누락 `0`.
- 실사용 owner/desk JWT로 원격 쓰기 시도는 수행하지 않았다. 권한은 정책 SQL과 schema contract로 확인했다.
- Supabase advisor: 보안 WARN은 의도적으로 호출 가능한 [SECURITY DEFINER RPC 10건](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)과 [누출 비밀번호 보호 설정 1건](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)이다. 성능 WARN은 [다중 permissive policy 17건](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)과 [중복 index 1건](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index)이다. 이번 변경에서 신규 SECURITY DEFINER 함수는 추가하지 않았다.

## UI·브라우저 검증

- 데모 URL: `http://127.0.0.1:3108/finance/lesson-income`.
- Chrome에서 390px와 1440px 화면을 직접 확인했다. 390px에서는 레슨수입·최종금액·수납 버튼이 한 화면에 보이고 문서 가로 넘침이 없다. 1440px에서는 전체 열이 표로 보인다.
- 좁은 헤더의 작업 메뉴는 제목 오른쪽 아이콘 버튼으로 정리했다. 툴팁과 접근 가능한 이름을 유지한다.
- E2E는 390px 가로 넘침과 수납 버튼 노출을 포함해 10건 통과.

## 검증 명령

| 명령 | 결과 |
| --- | --- |
| `pnpm test:run --reporter=dot` | 60개 파일, 341개 통과 |
| `pnpm lint` | 통과 |
| `pnpm build` | 통과 |
| `pnpm test:e2e` | 10개 통과 |
| `git diff --check` | 통과 |

## Quality Consolidation

- **가독성:** 학원 일정 필수 조건에 이름 있는 도메인 validator를 두고, 납부 상태·현재 날짜·finance 쿼리 범위를 명시했다.
- **예측 가능성:** 교재 결제 완료는 분리된 세 요청이 아닌 한 RPC에서만 확정한다. 조회 실패 시 가짜 수납 행을 만들지 않는다. 테스트 시계를 고정했다.
- **응집도:** 등록 검증을 도메인에, row 변환을 API adapter에, 원장 일관성은 DB 함수에 둔다. finance query prefix는 `queryKeys.finance.all`로 공유한다.
- **결합도:** AppShell은 지급/수납 계산을 알지 않고 action slot만 표시한다. 좁은 목록과 넓은 표는 같은 row와 `LessonIncomePaymentAction`을 사용한다.
- **simplify 결과:** 교재의 세 단계 client insert 제거, 오래된 출고일 기본값 제거, finance query prefix 중복 제거, 불완전한 학원 일정을 걸러 내던 분기 제거.
- Critical: 발견한 부분 저장 가능성과 과거 원장 누락을 수정했다.
- Warning: 급여 지급 RPC는 owner가 전달한 금액·레슨 ID를 서버에서 재계산하지 않는다. owner만 원장 변경 가능하고 audit은 남지만, 서버 금액 대조는 별도 강화가 필요하다. 교재 발주 batch와 개별 출고의 연결이 없어 발주일을 임의로 출고일로 채우지 않고 `-`로 표시한다. 대시보드 작업 건수는 아직 정적 예시 값이다. `finance-management-screens.tsx`는 하위 화면이 한 파일에 모여 있어 다음 수입 관리 변경 때 화면별 분리를 검토한다.

## Git

- 커밋·push: 수행하지 않음.
