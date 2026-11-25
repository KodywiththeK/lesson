# 알림(아침 메일·푸시) 운영 준비

2026-11-19 1단계(오늘 할 일·아침 브리핑 메일·PWA 푸시)를 운영에서 켜는 절차다. 코드가 배포돼도 아래 설정이 없으면 메일·푸시는 조용히 꺼져 있고(503 응답 또는 호출 생략) 앱의 다른 기능에는 영향이 없다.

## 구조

- 즉시 푸시: DB 트리거 → `notification_outbox` → pg_cron 1분마다(대기열이 있을 때만) pg_net으로 `POST /api/notifications/dispatch` → web-push.
- 아침 브리핑: pg_cron `0 23 * * *`(한국 08:00) → `POST /api/cron/morning-brief` → Resend 메일 + web-push 한 줄. `morning_brief_deliveries`가 사람·채널별 하루 한 번만 보내게 막는다.
- 두 주소 모두 `Authorization: Bearer <CRON_SECRET>`이 맞아야 실행된다.

## 1. 메일 도메인(Resend)

1. 학원 도메인을 준비한다(구매 또는 기존 도메인).
2. Resend에 가입해 도메인을 추가하고 안내된 DNS 레코드(SPF·DKIM, 권장 DMARC)를 도메인 관리 화면에 등록한다. 인증 완료(Verified)까지 기다린다.
3. API 키를 만든다(권한: Sending access, 도메인 한정 권장).
4. 무료 요금은 하루 100통·월 3,000통이다(가입 시 현재 조건 확인).

## 2. VAPID 키(웹 푸시)

```bash
pnpm exec web-push generate-vapid-keys
```

공개 키는 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, 비공개 키는 `VAPID_PRIVATE_KEY`에 넣는다. 키를 바꾸면 기존 기기 구독이 모두 무효가 되어 각자 다시 켜야 한다.

## 3. Vercel 환경변수(Production)

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `RESEND_API_KEY` | Resend API 키 | 서버 전용 |
| `MAIL_FROM` | `마디마디 <noreply@학원도메인>` | 인증한 도메인 주소 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID 공개 키 | 브라우저에 노출돼도 됨 |
| `VAPID_PRIVATE_KEY` | VAPID 비공개 키 | 서버 전용 |
| `CRON_SECRET` | 32자 이상 임의 문자열 | Vault의 `cron_secret`과 같아야 함 |
| `APP_BASE_URL` | `https://lesson-pi-ten.vercel.app` | 메일 링크·VAPID 발신자 |
| `SUPABASE_SERVICE_ROLE_KEY` | (기존) | 서버 전용 |

설정 후 재배포한다.

## 4. Supabase

1. migration을 순서대로 적용한다(`docs/engineering/supabase-migration-runbook.md` 절차, 사용자 요청 시에만): `20261119000000_daily_tasks` → `20261119000100_notification_settings` → `20261119000200_notification_outbox`(pg_net 확장 포함) → `20261119000300_morning_brief`. 앱 배포 전에 DB를 먼저 적용한다(대시보드가 새 RPC를 부른다).
2. Vault에 비밀값 두 개를 넣는다(SQL Editor):

```sql
select vault.create_secret('https://lesson-pi-ten.vercel.app', 'app_base_url');
select vault.create_secret('<CRON_SECRET과 같은 값>', 'cron_secret');
```

3. 확인: `select jobname, schedule from cron.job where jobname in ('notification-dispatch', 'morning-brief');`

## 5. 동작 확인

- 내 알림 설정 → 이 기기에서 알림 켜기 → 테스트 알림 보내기(아이폰은 홈 화면에 추가한 앱에서).
- 상담을 하나 등록해 1분 안에 원장·데스크 기기에 푸시가 오는지 확인한다. 실패하면 `select kind, attempts, last_error from notification_outbox order by created_at desc limit 10;`과 `select * from net._http_response order by created desc limit 5;`를 본다.
- 아침 브리핑은 수동으로 한 번 실행해 볼 수 있다(같은 날 두 번 보내지 않는다):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://lesson-pi-ten.vercel.app/api/cron/morning-brief
```
