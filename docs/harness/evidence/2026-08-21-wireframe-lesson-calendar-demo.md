# 2026-08-21 와이어프레임 기반 레슨 캘린더와 예시 데이터 보강

## 목표

- 첨부 HTML `수업.html`은 지시가 아니라 와이어프레임 참고 자료로만 사용했다.
- 사용자 요청에 따라 현재 구현과 HTML 구성을 대조하고, 레슨 시간표의 누락 UX를 보강했다.
- 앱을 바로 탐색할 수 있도록 주요 페이지에 예시 데이터를 연결했다.

## 반영 범위

- 레슨 시간표
  - `학원 레슨표` / `개인레슨표` 탭을 추가했다.
  - 학원/개인레슨 월간 캘린더와 선택 날짜 일정 패널을 추가했다.
  - 학원 레슨표에 메모지, 미등원 인원, 보강 입력 흐름을 추가했다.
  - 개인레슨표에 레슨시간표 보내기와 개인레슨 등록 후 캘린더 반영 흐름을 연결했다.
  - 모바일에서는 월간 7열 캘린더 구조를 유지하고 이벤트를 축약 표시하도록 조정했다.
- 예시 데이터
  - 원생, 선생님, 회차권, 거래처, 교재, 수입 페이지가 바로 내용을 보여주도록 데모 query factory를 연결했다.
  - 로컬 Supabase 개발용 `supabase/seed.sql`에 owner/teacher 계정, 학원, 원생, 선생님, 수업, 출석, 회차권, 교재, 수입/지출, 급여 예시 데이터를 추가했다.

## TDD 기록

- 먼저 실패 테스트를 작성했다.
  - `src/features/lessons/lesson-management-workspace.test.tsx`
  - 최초 실행 결과: 컴포넌트 미존재로 실패.
- 구현 후 테스트를 통과시켰다.
  - 학원/개인레슨 캘린더 표시
  - 미등원 보강 입력 후 메모 반영
  - 선생님별 개인레슨 시간표 생성
  - 개인레슨 등록 후 캘린더 반영
- Quality Consolidation에서 테스트 selector를 사용자 화면 구조 기준으로 정리했다.
  - 회차권 상태는 원생 행 내부 배지로 검증.
  - E2E의 `김민지` 중복 텍스트 locator는 선택 일정 패널 기준으로 좁힘.

## 검증 증거

- `pnpm test:run`
  - 52 files passed
  - 211 tests passed
- `pnpm lint`
  - 통과
- `pnpm typecheck`
  - 통과
- `pnpm build`
  - 통과
  - 참고: Node.js 20 이하에 대한 Supabase JS deprecation warning이 표시됨. 현재 빌드는 성공.
- `pnpm test:e2e`
  - 8 passed
- Playwright screenshot
  - 데스크톱: `/tmp/lesson-desktop.png`
  - 모바일 최종: `/tmp/lesson-mobile-final.png`

## 남은 리스크

- `supabase/seed.sql`은 로컬 개발용으로 작성했으며, 원격 DB에는 적용하지 않았다.
- 실제 원격 DB에 샘플 데이터를 넣을지는 제품/운영 정책 결정이 필요하다.
- Playwright screenshot CLI는 macOS 샌드박스에서 Chromium 권한 오류가 발생해 승인된 샌드박스 외부 실행으로 캡처했다.
- 빌드와 `pnpm test:e2e`를 병렬 실행하면 Next build lock 충돌이 난다. 최종 검증은 순차 실행으로 통과했다.
