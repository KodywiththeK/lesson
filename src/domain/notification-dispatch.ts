import { describeLessonChange, lessonHref, type LessonChangeFacts } from "./daily-tasks";
import { formatMonthDay, formatSeoulTime, toFinanceDate } from "./finance-date";
import {
  canReceiveNotification,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "./notification-settings";
import type { AcademyRole } from "./permissions";

/** 사건을 일으킨 사람. 본인에게는 알리지 않는다. 트리거가 넣고, 알 수 없으면 비어 있다. */
type ActorPayload = { actorId?: string | null };

/** DB `notification_outbox` 한 행. 트리거가 사건이 일어날 때 적재한다. */
export type NotificationOutboxEvent =
  | {
      id: string;
      kind: "lesson_change";
      payload: LessonChangeFacts &
        ActorPayload & {
          lessonKind: "academy" | "private";
          studentName: string;
          /** 이 레슨에 닿는 선생님(이전·새 담당). */
          teacherIds: string[];
        };
    }
  | { id: string; kind: "consultation"; payload: { name: string } & ActorPayload }
  | { id: string; kind: "join_request"; payload: { applicantName: string } & ActorPayload };

export type NotificationRecipientCandidate = {
  userId: string;
  role: AcademyRole;
  /** 선생님 계정이면 연결된 teacher id. */
  teacherId: string | null;
  preferences: NotificationPreferences;
};

export type PushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** 있으면 서비스 워커가 앱 아이콘 배지를 이 수로 바꾼다(0이면 지움). */
  badgeCount?: number;
};

/** 사건별 설정 항목. 받을 수 있는 역할은 설정 항목(`NOTIFICATION_SETTING_ITEMS`)이 정한다. */
const EVENT_PREFERENCES: Record<NotificationOutboxEvent["kind"], NotificationPreferenceKey> = {
  lesson_change: "pushLessonChange",
  consultation: "pushConsultation",
  join_request: "pushJoinRequest",
};

/** 사건마다 받을 사람(user id). 역할·담당 선생님·개인 설정을 함께 보고, 사건을 일으킨 본인은 뺀다. */
export function resolvePushRecipients<Candidate extends NotificationRecipientCandidate>(
  event: NotificationOutboxEvent,
  candidates: Candidate[],
): Candidate[] {
  const preference = EVENT_PREFERENCES[event.kind];

  return candidates
    .filter((candidate) => candidate.userId !== event.payload.actorId)
    .filter((candidate) => canReceiveNotification(candidate.role, preference) && candidate.preferences[preference])
    .filter(
      (candidate) =>
        candidate.role !== "teacher" ||
        (event.kind === "lesson_change" &&
          candidate.teacherId !== null &&
          event.payload.teacherIds.includes(candidate.teacherId)),
    );
}

/** 사건의 푸시 문구. `today`는 발송 시점의 한국 날짜이며 레슨 변경이 오늘인지 내일인지 가른다. */
export function buildPushPayload(event: NotificationOutboxEvent, today: string): PushMessage {
  if (event.kind === "lesson_change") {
    return {
      title: lessonChangeTitle(event.payload, today),
      body: lessonChangeBody(event.payload),
      url: lessonHref(event.payload.lessonKind),
      tag: `lesson-change:${event.id}`,
    };
  }

  if (event.kind === "consultation") {
    return {
      title: "신규 상담 접수",
      body: `${event.payload.name} 상담이 등록되었습니다.`,
      url: "/management/consultations",
      tag: `consultation:${event.id}`,
    };
  }

  return {
    title: "직원 가입 요청",
    body: `${event.payload.applicantName} 님이 가입을 요청했습니다. 승인해 주세요.`,
    url: "/settings/members",
    tag: `join-request:${event.id}`,
  };
}

type LessonChangePayload = Extract<NotificationOutboxEvent, { kind: "lesson_change" }>["payload"];

/** 바뀌기 전이나 후 중 오늘 레슨이 있으면 오늘, 아니면 내일 변경이다(트리거가 오늘·내일만 넣는다). */
function lessonChangeTitle(payload: LessonChangePayload, today: string) {
  const dates = [payload.previousStartsAt, payload.nextStartsAt].filter((value): value is string => value !== null);

  return dates.some((value) => toFinanceDate(value) === today) ? "오늘 레슨 변경" : "내일 레슨 변경";
}

function lessonChangeBody(payload: LessonChangePayload) {
  const { type, detail } = describeLessonChange(payload);

  if (type === "teacher") {
    return `${payload.studentName} 담당 ${detail}`;
  }

  // 날짜를 넘겨 옮겼으면 시간만으로는 헷갈리므로 날짜를 함께 적는다.
  if (
    type === "time" &&
    payload.nextStartsAt !== null &&
    toFinanceDate(payload.previousStartsAt) !== toFinanceDate(payload.nextStartsAt)
  ) {
    return `${payload.studentName} ${formatDayTime(payload.previousStartsAt)} → ${formatDayTime(payload.nextStartsAt)}`;
  }

  return `${payload.studentName} ${detail}`;
}

function formatDayTime(value: string) {
  return `${formatMonthDay(toFinanceDate(value))} ${formatSeoulTime(value)}`;
}
