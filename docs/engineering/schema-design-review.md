# Supabase 스키마 설계 리뷰

## 결론

현재 구조는 여러 음악학원이 가입해서 사용하는 SaaS 방향에 맞게 유지하는 것이 좋다. 핵심 이유는 tenant 경계를 `academy_id`로 명시하고, Supabase RLS와 Postgres 복합 외래키가 서로 다른 종류의 위험을 나눠 막기 때문이다.

## 구조 설명

데이터의 최상위 소유 단위는 `academies`다. 사용자는 `profiles`에 있고, 학원별 권한은 `academy_members`가 가진다. 원장, 데스크, 선생님은 하나의 전역 권한이 아니라 학원별 멤버십 역할이다. 그래서 한 사용자가 A 학원에서는 원장이고 B 학원에서는 선생님인 확장도 가능하다.

운영 데이터는 모두 `academy_id`를 가진다. 원생, 선생님, 수업, 출결, 회차권, 교재, 수입, 급여, 감사 로그가 같은 tenant scope 안에서만 연결되도록 `(academy_id, id)` 복합 unique key와 `(academy_id, *_id)` 복합 foreign key를 둔다. RLS가 접근 권한을 막고, 복합 FK가 다른 학원 row를 잘못 연결하는 데이터 오염을 막는다.

권한 판단은 public policy 안에 직접 긴 SQL을 반복하지 않고 `private` schema의 helper function으로 모은다. helper function은 `auth.uid()`와 `academy_members`를 기준으로 active membership, 역할, 선생님 담당 원생 여부를 확인한다. public schema에는 앱이 접근할 테이블만 명시적으로 grant하고 모든 public table에 RLS를 켠다.

앱 코드는 원격 DB에서 생성한 `src/lib/supabase/database.types.ts`를 browser/server/proxy client에 연결한다. 기능 화면에서는 Supabase client 전체 타입을 그대로 퍼뜨리지 않고, 각 기능별 adapter port 타입으로 좁혀 테스트가 원격 DB에 의존하지 않게 유지한다.

## 이번 리뷰에서 보완한 점

학원 생성 직후에는 아직 `academy_members` row가 없을 수 있다. 이 상태에서 `academies` insert 후 `.select()`로 생성된 id를 받으려 하면 기존 `academies_select_active_members` 정책만으로는 조회가 막힐 수 있다. 그래서 `academies_select_creator` 정책을 추가해 생성자가 owner 멤버십 bootstrap을 완료할 수 있게 했다.

## 보수적으로 남겨둔 결정

- 선생님은 담당 원생과 수업을 조회할 수 있지만, 보호자 연락처는 기본 노출하지 않는다.
- 출결 처리, 보강 확정, 회차권 차감 권한은 owner/desk 중심으로 시작한다.
- 급여, 고정 수입, 감사 로그는 owner 중심으로 잠근다.
- 데스크의 재무 접근, 선생님의 본인 급여 조회, 학원 소유권 이전과 생성자 권한 회수는 제품 정책 확정 후 별도 migration으로 세분화한다.

## 다음 최적화 후보

- 학원 생성과 owner 멤버십 생성을 하나의 server action 또는 RPC로 묶어 온보딩을 원자적으로 처리한다.
- 역할별 RLS 런타임 테스트 데이터를 만들고 owner/desk/teacher/anonymous 접근을 자동 검증한다.
- 수업 생성, 출석 확정, 회차권 차감, ledger 생성은 DB transaction 경계가 필요하므로 mutation phase에서 server-only 경로로 묶는다.
- 장기적으로 학원 구독 플랜, 초대, 지점, 감사 로그 보관 기간을 tenant 설정으로 분리한다.
