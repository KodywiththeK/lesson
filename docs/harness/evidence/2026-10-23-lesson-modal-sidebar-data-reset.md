# 레슨 모달·사이드바 스크롤·테스트 데이터 초기화 Evidence

## 요약

- 목표: 날짜별 출석 모달의 저장 경계를 명확히 하고, 메뉴 이동 뒤 사이드바 스크롤을 복원하며, 정식 테스트 전에 운영 업무 데이터를 비운다.
- 완료한 변경:
  - 날짜 모달 하단을 `닫기`와 `출석 저장`으로 구분했다.
  - 일정 삭제 확인창의 취소·삭제 콜백 경계를 테스트로 고정했다.
  - 데스크톱·모바일 navigation 스크롤을 별도 `sessionStorage` 키로 저장·복원한다.
  - 운영 DB에서 원장 계정·프로필·학원·활성 원장 멤버십만 남기고 업무 데이터를 비웠다.
  - 제품 명세, 인수 시나리오, 추적 매트릭스, 디자인 시스템, Supabase runbook과 결정 기록을 갱신했다.
- 커버한 요구사항: 날짜 모달 버튼 역할, 삭제 취소 안전성, 같은 탭의 navigation 위치 보존, schema·migration을 유지하는 일회성 운영 데이터 초기화.

## 먼저 작성한 테스트

- 테스트 파일:
  - `src/features/lessons/academy-day-attendance-dialog.test.tsx`
  - `src/features/lessons/academy-lesson-delete-dialog.test.tsx`
  - `src/app/app-shell.test.tsx`
  - `tests/e2e/home.spec.ts`
- 시나리오:
  - 닫기는 출석 초안을 저장하지 않고, 출석 저장만 저장 callback을 호출한다.
  - 삭제 확인창의 취소는 삭제 callback을 호출하지 않는다.
  - shell 재생성·drawer 재열기 뒤 각 navigation의 `scrollTop`이 복원된다.
  - 브라우저에서 삭제 취소 뒤 일정과 날짜 모달이 유지된다.
- 초기 실패: 기존 모달에 `취소`·`확인`만 있었고 navigation 스크롤 영역에 저장 키와 접근 가능한 이름이 없어 관련 테스트 4건이 의도한 이유로 실패했다. 삭제 확인창 단위 테스트 2건은 기존 구현이 이미 올바르게 통과했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| 관련 컴포넌트 테스트 3개 파일 | 22개 통과 | 모달·삭제·AppShell |
| 레슨 workspace 영향 테스트 3개 파일 | 69개 통과 | 옛 버튼명 기대값을 새 계약으로 갱신 |
| `pnpm typecheck` | 통과 | Next route type 생성 포함 |
| `pnpm lint` | 통과 | 오류·경고 없음 |
| `pnpm test:run --reporter=dot` | 182개 파일, 2,063개 통과 | 기존 chart 크기 stderr 안내만 있음 |
| `pnpm test:e2e` | 빌드 통과, 최초 26/27 | 새 테스트 locator의 부분 일치 문제 발견 |
| `NEXT_PUBLIC_E2E_DEMO=1 pnpm exec playwright test --grep "사이드바와 모바일 메뉴"` | 1개 통과 | locator를 `exact`로 고친 뒤 재검증 |
| `NEXT_PUBLIC_E2E_DEMO=1 pnpm exec playwright test` | 27개 통과 | locator 수정 후 전체 브라우저 회귀 테스트 최종 통과 |
| `git diff --check` | 통과 | 공백 오류 없음 |

## 브라우저 증거

- URL: `https://lesson-pi-ten.vercel.app/management/students`, `/lessons/academy`, `/passes`, `/books`, `/finance/lesson-income`
- 데스크톱 확인: 원장 로그인 후 원생 `총 0명`, 회차권 없음, 교재 `총 0건`, 수입 `총 0건`이 표시되고 불러오기 오류가 없었다.
- 레슨 확인: 학원레슨 캘린더 1개가 렌더링되고 일정 칩은 0개이며 `불러오지 못했습니다` 문구가 없었다.
- 반응형 확인: Playwright에서 1024px 데스크톱과 320px 모바일 navigation 스크롤 복원을 확인했다.
- 비고: E2E는 운영 데이터와 분리된 데모 빌드를 사용했다. 운영 빈 화면은 배포 앱과 실제 운영 DB로 별도 확인했다.

## Supabase 증거

- Migration: 없음. 재실행되는 migration이나 `db reset --linked`를 쓰지 않고 MCP `execute_sql`의 일회성 단일 트랜잭션으로 수행했다.
- 사전 조건: 학원 1개, 활성 원장 1명, 학원 생성자와 원장 일치, Auth 사용자 2명, profile 2건, membership 2건, Storage bucket·object 0건.
- 삭제 전 주요 업무 데이터: 선생님 5, 원생 10, 담당 관계 14, 연락처 10, 수강 14, 레슨 일정 149, 출석 23, 결석 처리 4, 월 메모 2, 날짜 메모 3, 회차권 등록 2, 교재 3, 입고 2, 출고 1, 월 수강료 18, 급여 설정 5, 급여 정산 2, 원장 11, 감사 106건.
- 실행: `lock_timeout=5s`, `statement_timeout=30s`, 유지 조건 검사, 업무 테이블 명시적 `TRUNCATE`, 비원장 Auth 사용자 삭제, 감사 로그 정리, 트랜잭션 내부 사후 조건 검사 순서로 처리했다. 첫 시도는 `min(uuid)` 미지원 오류로 사전 조건 단계에서 전체 롤백됐고, 단일 행 조회로 수정한 뒤 성공했다.
- 사후 조건: Auth 사용자·identity·profile·academy·membership 각 1건, 활성 원장 1명, 업무 테이블 전부 0건, Storage 0건. session·refresh token은 모두 유지한 원장 한 명에게만 연결됐다.
- 커밋 전 재확인: public 업무 테이블 31개는 모두 0건(`business_nonzero_count=0`)이고, 비원장 Auth 사용자·session·refresh token도 모두 0건이었다. 원장 Auth·identity·profile, academy, 활성 owner membership은 각각 1건이며 학원 생성자와 원장 membership도 일치했다.
- migration history: 적용 전후 52건, 마지막 버전 `20261021090400`으로 동일하다.
- RLS 확인: schema·policy를 변경하지 않았다.
- 역할별 확인: 보존한 원장 계정으로 실제 배포 앱 로그인과 빈 화면 조회를 확인했다. 삭제한 선생님 계정 로그인은 별도 시도하지 않았다.

## 품질 정리

- 코드 단순화: 스크롤 저장·복원과 저장소 예외 처리를 `PersistentNavigationScrollArea` 한 곳으로 모으고 sidebar와 drawer는 키·레이아웃만 전달한다.
- 재사용한 추상화: 기존 navigation SSOT와 shadcn Dialog·AlertDialog를 그대로 사용했다.
- 테스트 정리: 새 단위 테스트 외에 기존 레슨 workspace 테스트의 사용자 문구를 새 계약으로 맞췄다.
- 가독성: `NAVIGATION_SCROLL_STORAGE_KEYS`, `restoreSignal`, `closeAndDiscard`, `confirmAttendance`가 실제 역할을 드러낸다.
- 예측 가능성: `닫기`는 초안만 폐기하고 즉시 저장 작업은 각 확인창에서 끝난다. storage 사용 실패는 navigation 자체를 막지 않는다.
- 응집도: 레슨 초안은 기존 hook, 삭제 확인은 삭제 dialog, 스크롤 상태는 layout 컴포넌트가 각각 소유한다.
- 결합도: pathname이나 feature 상태를 스크롤 저장 키에 넣지 않아 메뉴 구조와 페이지 구현이 서로 의존하지 않는다.
- simplify 결과: boolean 복원 신호 하나로 drawer 재열기와 route remount를 같은 컴포넌트에서 처리했다. 문서에서 출석 저장의 후속 결과가 삭제 시나리오에 붙은 위치 오류를 바로잡았다.
- 코드 품질 리뷰: Critical·Warning 없음. storage API는 `try/catch`로 격리했고 DB 초기화는 보존 조건이 어긋나면 롤백하도록 했다.
- 남긴 Warning/Suggestion: Node.js 20 이하에 대한 Supabase SDK 지원 중단 예정 경고가 빌드에 남아 있다. 이번 기능 변경과 무관하며 런타임 Node 22 전환 시 별도 검증이 필요하다.
- 남은 부채: 없음.

## 위험과 확인 질문

- 위험: 사용자가 확정한 대로 삭제 전 백업은 만들지 않았으므로 초기화한 테스트 데이터는 복원할 수 없다.
- 후속 질문: 없음.

## Git

- 커밋: 하지 않음.
- push 여부: 하지 않음.
