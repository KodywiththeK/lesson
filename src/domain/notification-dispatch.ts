import { describeLessonChange, lessonHref, type LessonChangeFacts } from "./daily-tasks";
import {
  canReceiveNotification,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "./notification-settings";
import type { AcademyRole } from "./permissions";

/** DB `notification_outbox` 한 행. 트리거가 사건이 일어날 때 적재한다. */
export type NotificationOutboxEvent =
  | {
      id: string;
      kind: "lesson_change";
      payload: LessonChangeFacts & {
        lessonKind: "academy" | "private";
        studentName: string;
        /** 이 레슨에 닿는 선생님(이전·새 담당). */
        teacherIds: string[];
      };
    }
  | { id: string; kind: "consultation"; payload: { name: string } }
  | { id: string; kind: "join_request"; payload: { applicantName: string } };

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
};

/** 사건별 설정 항목. 받을 수 있는 역할은 설정 항목(`NOTIFICATION_SETTING_ITEMS`)이 정한다. */
const EVENT_PREFERENCES: Record<NotificationOutboxEvent["kind"], NotificationPreferenceKey> = {
  lesson_change: "pushLessonChange",
  consultation: "pushConsultation",
  join_request: "pushJoinRequest",
};

/** 사건마다 받을 사람(user id). 역할·담당 선생님·개인 설정을 함께 본다. */
export function resolvePushRecipients(
  event: NotificationOutboxEvent,
  candidates: NotificationRecipientCandidate[],
): string[] {
  const preference = EVENT_PREFERENCES[event.kind];

  return candidates
    .filter((candidate) => canReceiveNotification(candidate.role, preference) && candidate.preferences[preference])
    .filter(
      (candidate) =>
        candidate.role !== "teacher" ||
        (event.kind === "lesson_change" &&
          candidate.teacherId !== null &&
          event.payload.teacherIds.includes(candidate.teacherId)),
    )
    .map((candidate) => candidate.userId);
}

export function buildPushPayload(event: NotificationOutboxEvent): PushMessage {
  if (event.kind === "lesson_change") {
    const { type, detail } = describeLessonChange(event.payload);
    const body =
      type === "teacher" ? `${event.payload.studentName} 담당 ${detail}` : `${event.payload.studentName} ${detail}`;

    return {
      title: "오늘 레슨 변경",
      body,
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
