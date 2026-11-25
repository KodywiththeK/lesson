import { describe, expect, it } from "vitest";

import { DEFAULT_NOTIFICATION_PREFERENCES } from "./notification-settings";
import {
  buildPushPayload,
  resolvePushRecipients,
  type NotificationOutboxEvent,
  type NotificationRecipientCandidate,
} from "./notification-dispatch";

const candidates: NotificationRecipientCandidate[] = [
  { userId: "owner", role: "owner", teacherId: null, preferences: DEFAULT_NOTIFICATION_PREFERENCES },
  { userId: "desk", role: "desk", teacherId: null, preferences: DEFAULT_NOTIFICATION_PREFERENCES },
  { userId: "kim", role: "teacher", teacherId: "teacher-kim", preferences: DEFAULT_NOTIFICATION_PREFERENCES },
  { userId: "lee", role: "teacher", teacherId: "teacher-lee", preferences: DEFAULT_NOTIFICATION_PREFERENCES },
];

const lessonMoved: NotificationOutboxEvent = {
  id: "outbox-1",
  kind: "lesson_change",
  payload: {
    changeType: "rescheduled",
    lessonKind: "academy",
    studentName: "한서아",
    teacherIds: ["teacher-kim"],
    previousStartsAt: "2026-11-19T05:00:00.000Z",
    nextStartsAt: "2026-11-19T06:30:00.000Z",
    previousTeacherName: null,
    nextTeacherName: null,
  },
};

describe("resolvePushRecipients", () => {
  it("오늘 레슨 변경은 원장·데스크와 그 레슨의 선생님에게 보낸다", () => {
    expect(resolvePushRecipients(lessonMoved, candidates)).toEqual(["owner", "desk", "kim"]);
  });

  it("개인레슨 선생님이 바뀌면 이전·새 선생님 모두 받는다", () => {
    const changed: NotificationOutboxEvent = {
      ...lessonMoved,
      payload: { ...lessonMoved.payload, teacherIds: ["teacher-kim", "teacher-lee"] },
    };

    expect(resolvePushRecipients(changed, candidates)).toEqual(["owner", "desk", "kim", "lee"]);
  });

  it("신규 상담은 원장·데스크만, 가입 요청은 원장만 받는다", () => {
    expect(
      resolvePushRecipients({ id: "o2", kind: "consultation", payload: { name: "정다은" } }, candidates),
    ).toEqual(["owner", "desk"]);
    expect(
      resolvePushRecipients({ id: "o3", kind: "join_request", payload: { applicantName: "홍길동" } }, candidates),
    ).toEqual(["owner"]);
  });

  it("해당 항목을 끈 사람은 받지 않는다", () => {
    const muted = candidates.map((candidate) =>
      candidate.userId === "desk"
        ? { ...candidate, preferences: { ...candidate.preferences, pushLessonChange: false } }
        : candidate,
    );

    expect(resolvePushRecipients(lessonMoved, muted)).toEqual(["owner", "kim"]);
  });
});

describe("buildPushPayload", () => {
  it("레슨 이동은 학생과 바뀐 시간을 한국 시간으로 적고 레슨표로 보낸다", () => {
    expect(buildPushPayload(lessonMoved)).toEqual({
      title: "오늘 레슨 변경",
      body: "한서아 14:00 → 15:30",
      url: "/lessons/academy",
      tag: "lesson-change:outbox-1",
    });
  });

  it("삭제와 선생님 변경 문구", () => {
    expect(
      buildPushPayload({
        ...lessonMoved,
        payload: { ...lessonMoved.payload, changeType: "deleted", nextStartsAt: null },
      }).body,
    ).toBe("한서아 14:00 레슨 취소");
    expect(
      buildPushPayload({
        ...lessonMoved,
        payload: {
          ...lessonMoved.payload,
          lessonKind: "private",
          nextStartsAt: lessonMoved.payload.previousStartsAt,
          previousTeacherName: "김선생",
          nextTeacherName: "이선생",
        },
      }),
    ).toMatchObject({ body: "한서아 담당 김선생 → 이선생", url: "/lessons/private" });
  });

  it("상담·가입 요청 문구와 이동 주소", () => {
    expect(buildPushPayload({ id: "o2", kind: "consultation", payload: { name: "정다은" } })).toEqual({
      title: "신규 상담 접수",
      body: "정다은 상담이 등록되었습니다.",
      url: "/management/consultations",
      tag: "consultation:o2",
    });
    expect(buildPushPayload({ id: "o3", kind: "join_request", payload: { applicantName: "홍길동" } })).toEqual({
      title: "직원 가입 요청",
      body: "홍길동 님이 가입을 요청했습니다. 승인해 주세요.",
      url: "/settings/members",
      tag: "join-request:o3",
    });
  });
});
