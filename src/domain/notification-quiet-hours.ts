import { addDays, formatSeoulTime, toFinanceDate } from "./finance-date";
import type { PushMessage } from "./notification-dispatch";

/** 방해 금지 시간. 시각은 한국 시간 `HH:mm`이며 시작은 포함, 끝은 포함하지 않는다. */
export type QuietHours = { enabled: boolean; start: string; end: string };

export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: true, start: "22:00", end: "08:00" };

/** 받은 알림 기록 종류. 알림함과 미룬 알림 묶음이 같이 쓴다. */
export type NotificationKind = "lesson_change" | "consultation" | "join_request" | "morning_brief";

const KIND_LABELS: Record<NotificationKind, string> = {
  lesson_change: "레슨 변경",
  consultation: "신규 상담",
  join_request: "가입 요청",
  morning_brief: "아침 브리핑",
};

/** 지금이 방해 금지 시간인지. 22:00~08:00처럼 밤을 넘기는 구간도 다룬다. */
export function isInQuietHours(quiet: QuietHours, now: Date) {
  if (!quiet.enabled || quiet.start === quiet.end) {
    return false;
  }

  const time = formatSeoulTime(now.toISOString());

  return quiet.start < quiet.end
    ? time >= quiet.start && time < quiet.end
    : time >= quiet.start || time < quiet.end;
}

/** 이 사람에게 푸시를 보낼 시각. 방해 금지 중이면 끝나는 시각, 아니면 지금. */
export function resolveDeliverAfter(quiet: QuietHours, now: Date): Date {
  if (!isInQuietHours(quiet, now)) {
    return now;
  }

  const today = toFinanceDate(now.toISOString());
  const endToday = seoulDateTime(today, quiet.end);

  return endToday > now ? endToday : seoulDateTime(addDays(today, 1), quiet.end);
}

/** 방해 금지가 끝나 한꺼번에 보낼 알림. 한 건이면 그대로, 여러 건이면 종류별 건수로 묶어 알림함을 연다. */
export function buildDeferredSummary(
  items: Array<{ kind: NotificationKind; title: string; body: string; url: string }>,
): PushMessage {
  if (items.length === 1) {
    const [item] = items;
    return { title: item.title, body: item.body, url: item.url, tag: "deferred" };
  }

  const counts = new Map<NotificationKind, number>();
  for (const item of items) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }

  return {
    title: `밤사이 알림 ${items.length}건`,
    body: [...counts].map(([kind, count]) => `${KIND_LABELS[kind]} ${count}`).join(" · "),
    url: "/me/inbox",
    tag: "deferred",
  };
}

function seoulDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+09:00`);
}
