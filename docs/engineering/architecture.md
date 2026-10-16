# 아키텍처

## 기준 스택

- 프레임워크: Next.js App Router + TypeScript
- 패키지 매니저: pnpm
- 인증/데이터베이스: Supabase
- API 상태 관리: TanStack Query
- UI: shadcn/ui + Tailwind CSS + semantic CSS variables
- 테스트: Vitest, React Testing Library, Playwright

## 제품 형태

이 앱은 특정 학원 하나만을 위한 내부 도구가 아니라 여러 음악학원이 가입해 사용하는 서비스로 설계한다. 초기 화면과 기능은 더 클래식 음악학원 PDF를 reference tenant 요구사항으로 삼지만, 데이터 모델과 권한 모델은 처음부터 학원 단위 tenant isolation을 전제로 둔다.

## 애플리케이션 구조

- Server Components는 가능한 한 읽기 전용 초기 데이터 로딩과 route shell을 담당한다.
- Client Components는 캘린더, 다이얼로그, 필터, 출석 체크, 보강 처리처럼 상호작용이 많은 UI를 담당한다.
- TanStack Query는 클라이언트 상호작용 API 상태, optimistic update, refetch, cache invalidation을 담당한다.
- Server Actions 또는 Route Handlers는 mutation 경계를 담당한다.
- 도메인 서비스는 회차권 차감, 출석 상태 전환, 급여 계산처럼 UI와 DB 밖에서도 테스트 가능한 규칙을 담당한다.
- Supabase helper는 런타임별로 browser client, server client, server-only admin utility를 분리한다.

## 도메인 경계

- `tenancy`: 학원, 학원 멤버십, 역할, 초대
- `students`: 원생 정보, 보호자 연락처, 악기별 수강 설정, 휴원/퇴원 상태 전환
- `teachers`: 선생님 정보, 담당 파트, 급여 설정
- `lessons`: 반복 일정, 개인레슨, 출석, 결석, 보강, 패스
- `tickets`: 회차권 부여, 차감, 만료, 수동 수정
- `books`: 교재 재고, 구매 목록, 출고, 결제 완료
- `finance`: 고정 수입, 미납 상태, ledger, 급여, 그래프
- `vendors`: 거래처 정보
- `consultations`: 상담 기록(원장·데스크 전용, 접수 1년 후 삭제)

## 데이터 흐름

- 학원 생성 후 사용자는 `academy_members`를 통해 역할을 얻는다.
- 원생 등록은 학원별 원생과 악기별 수강 설정을 만든다.
- 악기별 수강 설정은 반복 수업과 고정 수입 스냅샷의 기준이 된다.
- 출석 확인은 회차권 차감과 비율제 급여 계산의 입력이 된다.
- 교재 결제 완료는 수입 ledger에 반영된다.
- 급여 지급은 지출 ledger에 반영된다.
- 수입/지출 ledger는 전체 수입 계산의 source of truth다.

## TanStack Query 원칙

- query key는 tenant scope를 포함한다. 예: `["academy", academyId, "students", filters]`.
- mutation 성공 후 관련 query를 좁게 invalidate한다.
- 서버 권한 판단은 Supabase/RLS와 서버 경계에서 수행하고, 클라이언트 cache는 권한의 근거로 사용하지 않는다.
- 사용자 행동 중심 화면은 TanStack Query hook을 쓰되, 핵심 계산은 `src/domain` 순수 함수에서 검증한다.
- 낙관적 업데이트는 회차권 차감, 수납, 급여 지급처럼 돈/횟수에 영향을 주는 흐름에서는 별도 테스트와 rollback 기준이 있을 때만 사용한다.

## Supabase 원칙

- 노출 스키마의 모든 테이블은 RLS를 활성화한다.
- 정책은 `TO authenticated`만으로 끝내지 않고 학원 멤버십, 역할, 배정 관계를 함께 확인한다.
- 사용자 수정 가능 metadata는 권한 판단에 사용하지 않는다.
- service-role key는 서버 전용 관리 경로에만 둔다.
- owner, desk, teacher, anonymous 역할별 접근을 테스트한다.
- view를 만들 때는 가능한 `security_invoker = true`를 사용한다.
- Next.js App Router의 cookie 기반 세션은 root `proxy.ts`와 `src/lib/supabase/proxy.ts`에서 `auth.getClaims()`로 갱신한다.
- 현재 스키마 구조와 보완 지점은 `docs/engineering/schema-design-review.md`를 기준으로 검토한다.

## Migration 규칙

스키마 작업을 시작할 때는 다음 순서를 따른다.

1. 현재 Supabase changelog와 관련 문서를 확인한다.
2. `supabase migration new <name>`으로 migration 파일을 만든다.
3. 적용 전 dry-run을 실행한다.
4. 가능한 경우 advisor를 실행한다.
5. schema 변경 후 타입을 재생성한다.
