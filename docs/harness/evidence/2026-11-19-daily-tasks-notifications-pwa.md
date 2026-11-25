# 오늘 할 일·아침 브리핑 메일·PWA 푸시·내 알림 설정 (1단계)

## 요약

- 목표: 원장·데스크가 매일 아침 오늘 레슨과 챙길 일을 메일로 받고, 앱을 PWA로 설치해 즉시 알아야 할 일을 푸시로 받으며, 대시보드의 '오늘 할 일'로 처리한다.
- 완료한 변경:
  - 오늘 할 일: `src/domain/daily-tasks.ts`, `src/lib/api/daily-tasks.ts`, `src/features/dashboard/today-tasks.tsx`, 대시보드 상단 슬롯(`app-shell.tsx` `dashboardTop`), 데모 데이터 `src/lib/demo/daily-tasks-demo.ts`, migration `20261119000000_daily_tasks.sql`.
  - PWA: `manifest.ts`(standalone·테마색·maskable 아이콘), `public/sw.js`, `public/maskable-icon-512x512.png`, `/offline`, `next.config.ts` sw.js 헤더, `proxy.ts` matcher, `RegisterServiceWorker`, 레이아웃 `appleWebApp`·`viewport.themeColor`.
  - 내 알림 설정: `/me/notifications`, 헤더 종 아이콘, `src/domain/notification-settings.ts`, `src/features/notifications/*`, `src/lib/api/notification-settings.ts`, migration `20261119000100_notification_settings.sql`, 테스트 알림 `POST /api/notifications/test-push`.
  - 즉시 푸시: `src/domain/notification-dispatch.ts`, `src/lib/notifications/*`(web-push 발송기·전달·받는 사람·대기열 처리·크론 인증), `POST /api/notifications/dispatch`, migration `20261119000200_notification_outbox.sql`.
  - 아침 브리핑: `src/domain/morning-brief.ts`, `src/emails/morning-brief-email.tsx`(React Email), `src/lib/notifications/morning-brief-job.ts`, `resend-mailer.ts`, `POST /api/cron/morning-brief`, migration `20261119000300_morning_brief.sql`.
  - 공용화: `src/lib/supabase/service-role.ts`(공휴일 route의 인라인 생성 교체), `describeLessonChange`(할 일·푸시 공용), `formatWon`(domain/money-input).
  - 의존성: `web-push`, `resend`, `@react-email/components`, `@types/web-push`(dev).
  - 문서: `functional-spec.md`, `acceptance-scenarios.md`, `traceability-matrix.md`, `open-questions.md`, `docs/engineering/notifications-operations.md`.
- 커버한 요구사항: 사용자 확정 계획 `/Users/wyd/.claude/plans/1-proud-quail.md`의 1단계 전부. 2단계(다음 등원일 메모·대타·연주회 참가비·이론/연습 기록)는 제외.

## 먼저 작성한 테스트

- 도메인: `daily-tasks.test.ts`(13), `notification-settings.test.ts`(11), `notification-dispatch.test.ts`(7), `morning-brief.test.ts`(7) — 모듈 없음으로 실패 확인 후 구현. 단 `notification-settings.test.ts`는 실패 실행 없이 구현과 같은 차례에 작성했다.
- SQL 계약: `daily-tasks-contract`, `notification-settings-contract`, `notification-outbox-contract`, `morning-brief-contract` — migration과 함께 작성(문자열 계약 특성상 실패 단계는 문구 불일치 2건으로만 확인).
- 서버: `deliver-push`, `test-push-handler`, `dispatch-outbox`, `morning-brief-job`, `resend-mailer`는 모듈 없음 실패 확인 후 구현. `web-push-sender`, `recipients`, `service-role`은 구현과 같은 차례에 작성.
- UI: `today-tasks.test.tsx`(초기 2건 실패: 금액 문구 결합, mutation 인자), `notification-settings-screen.test.tsx`(모듈 없음 → region 역할 누락 실패 → 수정), `manifest.test.tsx`·`layout.test.tsx`·`pwa-config.test.tsx`·`offline/page.test.tsx`·`register-service-worker.test.tsx`·`me/notifications/page.test.tsx`(헤더 링크 없음) 실패 확인 후 구현. `service-worker.test.ts`는 vm으로 sw.js 이벤트를 실행해 확인.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run` | 281 파일 / 2619 테스트 통과 | simplify 반영 후 재실행 |
| `pnpm typecheck` | 통과 | |
| `pnpm lint` | 통과 | effect 안 setState 지적 → query로 수정 |
| `pnpm test:e2e` | 41 통과(simplify 반영 후 재실행) | manifest 아이콘 수 기대값 2→3 갱신(maskable 추가 의도 변경) |

## 브라우저 증거

- URL: 데모 빌드(`NEXT_PUBLIC_E2E_DEMO=1`) `http://localhost:3100/`, `/me/notifications`.
- 데스크톱: 대시보드 맨 위 오늘 할 일 5건, `답변 대기로` → 할 일 4·답변 대기 1, 처리자·시각 표시 확인.
- 모바일(375px): 할 일 행 버튼 줄바꿈, 알림 설정 스위치 배치, 가로 넘침 없음(`scrollWidth > innerWidth` false).
- PWA: 서비스 워커 scope `/` activated, `madimadi-offline-v1` 캐시에 `/offline`만 저장, sw.js 헤더(no-store·javascript), manifest standalone·#0572fc·아이콘 3개.
- 메일: 렌더 HTML을 390px로 캡처해 요약·시간표·할 일·링크 확인.
- 한계: 미리보기 브라우저는 알림 권한이 기본 차단이라 실제 구독·푸시 수신, Resend 실발송은 확인하지 못했다(운영 설정 후 `notifications-operations.md` 5절로 확인).

## Supabase 증거

- Migration: 4개 작성, 원격 미적용(사용자 요청 시 runbook 절차로 적용).
- RLS 확인: 새 테이블 5개(`daily_task_states`, `notification_preferences`, `push_subscriptions`, `notification_outbox`, `morning_brief_deliveries`) 모두 RLS on + anon/authenticated revoke, RPC로만 접근(계약 테스트).
- 역할별 확인: 원천 RPC의 owner/desk/teacher 범위·금액 null 처리, service_role 전용 RPC grant를 계약 테스트로 고정. 실제 역할 계정 호출은 미검증.
- 비고: 로컬 Postgres가 없어 SQL 실행 검증을 못 했다.

## 품질 정리

- 코드 단순화: 레슨 변경 설명을 `describeLessonChange`로 합쳐 할 일·푸시가 같은 문구를 쓰게 했고, 크론 인증을 `cron-auth.ts`로 분리, service-role 생성을 헬퍼로 모았다.
- 재사용한 추상화: `SectionCard`/`SectionHeader`/`EmptyState`/`StatusTabs`/`Switch`, `getClosuresOnDate`, `DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS`, `getFinanceToday`.
- 테스트 정리: 화면 테스트는 role·접근 가능한 이름 기준, 클래스 단언 없음.
- 가독성: 할 일 생성·브리핑·받는 사람 판단을 순수 함수로 두고 route는 의존성 연결만 한다.
- 예측 가능성: 할 일 key 규칙 `종류:원천 id` 고정, 금액 제거는 서버(RPC)와 도메인 두 곳에서 같은 규칙, 시간은 모두 Asia/Seoul 명시, 발송은 사람·채널·날짜당 1회.
- 응집도: 알림 서버 코드는 `src/lib/notifications`, 화면은 `src/features/notifications`, 판단은 `src/domain/notification-*`·`morning-brief`.
- 결합도: 도메인은 Resend·web-push를 모르고, 발송기·저장소·메일러는 의존성 주입으로 테스트한다. 대시보드는 finance 기능 대신 domain `formatWon`을 쓴다.
- simplify 결과(2026-11-26, 재사용·단순화·효율·추상화 4개 에이전트 병렬 검토 후 통합 반영):
  - SQL: 레슨 변경 해석을 `private.lesson_change_facts` 하나로 모아 할 일 원천과 알림 트리거가 같이 쓴다(담당 선생님 판단 불일치 해소, uuid 열 직접 비교로 색인 사용). 크론 호출을 `private.invoke_app_route`로 공용화, 매분 실행되던 오래된 행 삭제를 하루 1회 작업으로 옮기고 90일 지난 할 일 상태·발송 기록도 정리. 읽지 않은 메모는 개수만 반환.
  - 금액 거르기: 서버 한 곳으로 일원화(`get_daily_task_source_for_service`에 원장·데스크 범위 추가, 도메인 `withoutAmount` 제거). 업무 기준(납입일·상담 7일·회차권 잔여)은 도메인이 갖고 SQL은 넓게만 거른다.
  - 역할: 알림 받을 역할을 설정 항목 한 곳(`canReceiveNotification`)에서 정하고 발송·아침 메일이 따른다.
  - 공용 도우미: `formatSeoulTime`·`addDays`·`formatMonthDay`·`formatKoreanDateLabel`을 `finance-date.ts`로, `formatWon`을 domain으로 모아 기존 복사본(교재·수입 화면, 선생님 스케줄 문자)이 재사용. 알림 설정 행 변환·서비스 워커 등록·푸시 전달 타입(`DeliverPush`, `skipPush`)·푸시 메시지 타입 단일화, `lessonHref` 공용.
  - 효율: 아침 브리핑은 할 일 원천을 범위별 1회만 읽고 브리핑을 역할·선생님별 1회만 만들며 같은 문구 푸시를 묶어 보내고 수신자를 병렬 처리. 대기열 사건 병렬 발송. 대시보드 할 일 계산 메모·상태 변경 즉시 반영. 설정 화면 기기 상태 1회 조회, query key를 `queryKeys.notifications`로 등록.
  - 구조: 대시보드 바로가기를 `AppShell` 밖(`DashboardShortcuts`, `visible-navigation.ts`)으로 빼고 `dashboardTop` prop 제거, 할 일 버튼 블록 중복 제거.
  - 건너뜀: 발송 기록 RPC를 묶음 호출로 바꾸기(현재 규모에서 병렬 처리로 충분), 푸시 결과의 미사용 필드 정리, 테스트 알림 route의 지연 생성(효과 미미), 아침 브리핑 원천의 할 일 상태 JSON 공용화.
- 코드 품질 리뷰: Critical 없음.
- 남긴 Warning/Suggestion: `formatWon`이 features 두 곳(finance·books)에 기존 중복으로 남아 있다(이번 범위 밖).
- 남은 부채: 메일 템플릿 색은 메일 앱 제약으로 토큰 대신 hex 인라인(예외). maskable 아이콘에 원본 둥근 모서리 경계가 희미하게 보인다.

## 위험과 확인 질문

- 위험: migration 미적용 상태로 앱을 배포하면 대시보드 '오늘 할 일'이 RPC 없음 오류를 보인다 → DB 먼저 적용. Vercel Hobby 함수 시간 제한(60초) 안에서 학원 수가 많아지면 브리핑을 나눠야 한다.
- 결정 반영(2026-11-26): 선생님은 할 일 보기만(화면 버튼 숨김 + `set_daily_task_state` 원장·데스크 한정, 테스트 Red 확인 후 반영), 기간 기준 그대로, 보내는 사람 이름 `마디마디`, 학원 도메인은 구매 예정.
- 후속 질문: 2단계 진행(`open-questions.md`).

## Git

- 커밋: 하지 않음(요청 없음).
- push 여부: 없음.
