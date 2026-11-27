# 2026-11-28 알림 보완 6가지

## 요약

- 목표: 알림 점검에서 나온 6가지를 순서대로 보완한다(사용자 결정 2026-11-27).
  1. 본인 제외
  2. 내일 레슨 변경
  3. 방해 금지
  4. 알림함
  5. 테스트 메일·마지막 발송
  6. 앱 배지
- 완료한 변경
  1. 사건을 일으킨 사람에게는 보내지 않는다.
     - 트리거가 payload에 `actorId`를 넣는다. 레슨 변경은 `audit_events.actor_id`, 상담은 `auth.uid()`를 쓴다.
     - `resolvePushRecipients`가 그 사람을 뺀다.
  2. 레슨 변경 푸시 범위를 오늘·내일(KST)로 넓혔다.
     - 제목은 `오늘/내일 레슨 변경`이다.
     - 날짜를 넘겨 옮기면 본문에 날짜를 적는다.
     - 설정 문구는 `레슨 변경(오늘·내일)`로 바꿨다.
  3. 방해 금지
     - 사람마다 켜고 끄며, 기본은 켜짐 22:00~08:00이다.
     - 판단은 `src/domain/notification-quiet-hours.ts` 한 곳에서 한다.
     - 모든 푸시는 `notify`를 거친다. 알림함에 기록을 남기고, 방해 금지가 아닌 사람에게만 지금 보낸다.
     - 미룬 알림은 1분 발송이 사람별로 묶어 보낸다(`flushDeferredReceipts`). 1건이면 원래 문구, 여러 건이면 `밤사이 알림 N건`이다.
     - 설정 화면에 방해 금지 영역을 두었다.
  4. 알림함 `/me/inbox`
     - 최근 30일 알림과 `새 알림` 표시. 열면 읽음 처리한다.
     - 헤더 종이 알림함으로 가고, 안 읽은 알림이 있으면 점을 찍는다(학원별 수).
     - `/me/*`는 검색 제외 헤더를 단다.
  5. 테스트 메일
     - `/api/notifications/test-email`은 로그인한 본인 메일로만 보낸다.
     - 설정에 마지막 아침 메일 발송 시각을 보여 준다.
     - 테스트 푸시와 같은 인증·구성원 확인은 `academy-member-request.ts`로 모았다.
  6. 앱 배지
     - 아침 브리핑 푸시에 `badgeCount`를 담고, 서비스 워커가 `setAppBadge`를 부른다(0이면 지움).
     - 대시보드가 오늘 할 일 수(답변 대기 제외)로 배지를 맞춘다(`src/features/pwa/app-badge.ts`).
  - DB: `supabase/migrations/20261128000000_notification_improvements.sql`. 2026-11-28 운영에 적용했다(원격 이력 82건, 마지막 `20261128000000`, 앱 배포 전 적용).

## 먼저 작성한 테스트

- 기존 코드에 대해 먼저 실패를 확인한 테스트
  - `src/domain/notification-dispatch.test.ts`: 본인 제외, 내일 제목, 날짜 넘김 본문. 3건 실패를 확인했다.
  - `src/domain/notification-quiet-hours.test.ts`: 경계값 22:00·07:59·08:00, 같은 날 구간, 꺼짐, 미루는 시각, 묶음 문구. 모듈이 없어 실패했다.
  - `src/lib/notifications/notify.test.ts`: 지금 보냄과 미룸 분리, 받는 사람 없음, 사람별 묶음. 모듈이 없어 실패했다.
  - `src/features/notifications/notification-settings-screen.test.tsx`: 방해 금지, 마지막 메일, 테스트 메일, 새 문구. 5건 실패를 확인했다.
  - `src/features/notifications/notification-inbox-screen.test.tsx`: 목록, 새 알림, 읽음 처리, 빈 안내. 모듈이 없어 실패했다.
  - 배지
    - `src/features/pwa/app-badge.test.tsx`
    - `src/lib/pwa/service-worker.test.ts`: 2건 실패를 확인했다.
    - `src/domain/morning-brief.test.ts`의 badgeCount
    - `today-tasks.test.tsx`의 배지 동기화: 실패를 확인했다.
  - `src/lib/supabase/notification-improvements-contract.test.ts`: migration 계약
- 구현과 함께 작성한 테스트: `test-email-handler.test.ts`(401·403·503·409·본인 메일), `notification-bell.test.tsx`, `src/app/me/inbox/page.test.tsx`. 모듈이 없을 때 실패하는 수준만 확인했다.
- E2E: 종 → 알림함 → 알림 설정에서 방해 금지 끄기, `/me/inbox` 검색 제외 헤더

## 검증

| 명령 또는 확인 | 결과 |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | 통과(경고 0) |
| `pnpm test:run` | 292 파일 / 2674 테스트 통과 |
| `pnpm test:e2e` | 46 통과 |
| 로컬 Supabase `db reset --local` + 롤백 트랜잭션 실행 | 통과(아래) |

## Supabase 증거(로컬)

- migration 전체와 seed가 오류 없이 적용됐다.
- 원장 JWT로 실행한 결과
  - 알림함 목록에는 본인 2건만 보였다(다른 사람 1건 제외).
  - 안 읽은 수는 2에서 읽음 처리 뒤 0이 됐다.
  - 표를 직접 select하면 `permission denied`가 난다.
- 이전 앱처럼 6인자로 저장해도 방해 금지 값(23:00~07:00)이 유지됐다.
- 미룬 알림 가져가기: 첫 호출은 때가 된 1건만, 두 번째 호출은 0건이었다.
- 같은 `source_key` 두 번째 insert는 무시됐다(`INSERT 0 0`).
- 안 읽은 수는 다른 학원 id로 물으면 0이다.
- 내일 레슨 삭제 감사 기록은 대기열에 들어가고 `actorId`가 담겼다. 3일 뒤 레슨은 들어가지 않았다.

## 브라우저 증거

- 데모 빌드에서 확인했다.
  - 1280px: 내 알림 설정(테스트 메일 버튼, 마지막 메일 "아직 없음", 방해 금지 영역)
  - 375px: 방해 금지 시각 줄바꿈을 `22:00 부터 / 08:00 까지` 묶음으로 고쳤고, 가로 넘침이 없다.
  - 375px 알림함: `새 알림` 표시
- 데모로 확인할 수 없는 것
  - 실제 푸시 수신, 미룬 알림 묶음 발송, 메일 수신
  - 아이콘 배지: 설치한 앱에서만 보인다.
  - 운영 적용 후 원장 기기로 확인할 것: 테스트 메일, 종 점, 다른 사람이 레슨을 옮겼을 때 푸시, 본인 변경 시 푸시 없음

## 품질 정리(`/simplify`, 재사용·단순화·효율·높이 4관점 병렬 검토)

- 반영
  - 테스트 푸시·메일의 인증·구성원 확인 중복을 `authorizeAcademyMemberRequest`·`isActiveAcademyMember`로 모았다.
  - 알림함 중복 방지 키를 푸시 tag와 분리했다. `sourceKey`는 `outbox:<id>`, `morning-brief:<날짜>`이다.
  - "지금 보냄" 판단을 객체 동일성 비교에서 `isInQuietHours`로 바꿨다.
  - `resolvePushRecipients`를 받는 사람 객체를 돌려주는 제네릭으로 바꿔, 호출부의 Set 재조회와 투영을 없앴다.
  - 중복을 정리했다.
    - `EMPTY_SUMMARY` 재사용
    - 내부 타입 비공개
    - `PushPayload` 별칭을 `PushMessage`로 통일
  - 안 읽은 수를 알림함·읽음 처리와 같은 학원 범위로 맞췄다(RPC에 `p_academy_id`).
  - `NotificationBell`을 별도 파일로 옮겼다.
  - 설정 화면은 설정 읽기·저장 훅을 한 번만 쓴다.
  - 알림함 읽음 처리 effect의 의존성을 안정된 `mutate`로 바꿨다.
  - 서비스 워커 배지 코드를 단순화했다.
  - 발송 route도 VAPID가 없을 때 `skipPush`로 알림함 기록은 남긴다(아침 브리핑과 같은 규칙).
- 건너뜀(사유)
  - 안 읽은 수 조회를 세션 gate에서 알림 기능 hook으로 옮기는 것
    - 헤더는 QueryClient가 없는 화면 테스트에서도 그려진다.
    - 실제 로그인 세션은 gate 안에만 있다.
    - 대신 범위만 학원별로 맞췄다.
  - 미룬 아침 브리핑의 badgeCount 유지: 기본 방해 금지 끝(08:00)과 브리핑 시각이 같아 미뤄지지 않는다. 끝 시각을 08:00 뒤로 바꾼 사람만 배지가 대시보드 열 때 맞춰진다.
  - 서버·클라이언트 할 일 수 helper를 하나로 합치는 것: 두 계산 모두 `splitDailyTasksByState`의 open을 기준으로 해서 같다.
  - SQL 부분 index 추가, 안 읽은 수 Realtime, 묶음 발송의 구독 일괄 조회: 학원 규모에서 효과가 작다.
  - `seoulDateTime` 공용화: features의 helper를 domain으로 옮겨야 해서 범위 밖이다.
- 가독성: 판단(받는 사람·방해 금지·묶음 문구)은 도메인 순수 함수가 하고, 발송 코드는 조합만 한다.
- 예측 가능성
  - 모든 푸시가 `notify` 한 길로 나간다.
  - 방해 금지 판단은 TS 한 곳에서 하고, DB는 `deliver_after`만 비교한다.
- 응집도: 알림 발송은 `src/lib/notifications`, 화면은 `src/features/notifications`에 둔다.
- 결합도: 알림함은 받은 알림 기록만 읽는다.

## 남은 위험·질문

- 안 읽은 수는 화면이 보일 때 1분마다 다시 읽는다. 푸시가 와도 즉시 반영되지는 않는다.
- 묶음 알림 제목은 방해 금지 구간과 상관없이 `밤사이 알림`이다.
