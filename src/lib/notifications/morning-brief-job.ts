import type { DailyTaskSource, DailyTaskState } from "@/domain/daily-tasks";
import {
  buildMorningBrief,
  buildMorningBriefPush,
  type MorningBrief,
  type MorningBriefInput,
  type MorningBriefSource,
} from "@/domain/morning-brief";
import { canReceiveNotification } from "@/domain/notification-settings";

import type { DeliverPush } from "./deliver-push";
import type { NotificationRecipient } from "./recipients";

type Channel = "email" | "push";

/** 서버 할 일 원천 범위. 데스크는 금액 없이 받는다. */
export type TaskSourceScope = "owner" | "desk";

export type MorningBriefJobDependencies = {
  listAcademies: () => Promise<string[]>;
  loadBriefSource: (
    academyId: string,
    date: string,
  ) => Promise<{ briefSource: MorningBriefSource; taskStates: DailyTaskState[] }>;
  loadTaskSource: (academyId: string, date: string, scope: TaskSourceScope) => Promise<DailyTaskSource>;
  listRecipients: (academyId: string) => Promise<NotificationRecipient[]>;
  /** 같은 날 같은 사람·채널로 이미 보냈으면 false. */
  claim: (academyId: string, date: string, userId: string, channel: Channel) => Promise<boolean>;
  finish: (
    academyId: string,
    date: string,
    userId: string,
    channel: Channel,
    providerId: string | null,
    error: string | null,
  ) => Promise<void>;
  renderEmail: (brief: MorningBrief) => Promise<{ html: string; text: string }>;
  /** 메일 발송 설정이 없으면 null(메일은 건너뛴다). */
  sendEmail: ((message: { to: string; subject: string; html: string; text: string }) => Promise<{ id: string | null }>) | null;
  deliverPush: DeliverPush;
};

export type MorningBriefJobResult = {
  academies: number;
  emails: number;
  pushes: number;
  skipped: number;
  failures: Array<{ academyId: string; userId: string; channel: Channel; error: string }>;
};

/**
 * 매일 아침 학원마다 역할별 브리핑 메일과 한 줄 푸시를 보낸다. 사람·채널별로 하루 한 번만 보낸다.
 * 할 일 원천은 범위(원장·데스크)마다 한 번, 브리핑 내용은 역할·선생님마다 한 번만 만든다.
 */
export async function runMorningBrief(deps: MorningBriefJobDependencies, today: string): Promise<MorningBriefJobResult> {
  const result: MorningBriefJobResult = { academies: 0, emails: 0, pushes: 0, skipped: 0, failures: [] };

  for (const academyId of await deps.listAcademies()) {
    result.academies += 1;
    await runAcademy(deps, result, academyId, today);
  }

  return result;
}

async function runAcademy(
  deps: MorningBriefJobDependencies,
  result: MorningBriefJobResult,
  academyId: string,
  today: string,
) {
  const [{ briefSource, taskStates }, recipients] = await Promise.all([
    deps.loadBriefSource(academyId, today),
    deps.listRecipients(academyId),
  ]);
  const taskSources = new Map<TaskSourceScope, Promise<DailyTaskSource>>();
  const loadTaskSource = (scope: TaskSourceScope) => {
    if (!taskSources.has(scope)) {
      taskSources.set(scope, deps.loadTaskSource(academyId, today, scope));
    }
    return taskSources.get(scope) as Promise<DailyTaskSource>;
  };
  const inputFor = async (recipient: NotificationRecipient): Promise<MorningBriefInput> => ({
    briefSource,
    // 선생님은 금액 없는 보강·레슨 변경만 보므로 원장 범위에서 도메인이 거른다.
    taskSource: await loadTaskSource(recipient.role === "desk" ? "desk" : "owner"),
    taskStates,
    role: recipient.role,
    today,
    teacherId: recipient.teacherId ?? undefined,
  });
  const once = <T>(cache: Map<string, Promise<T>>, key: string, create: () => Promise<T>) => {
    if (!cache.has(key)) {
      cache.set(key, create());
    }
    return cache.get(key) as Promise<T>;
  };
  const briefs = new Map<string, Promise<MorningBrief & { html: string; text: string }>>();
  const pushGroups = new Map<string, { input: Promise<MorningBriefInput>; userIds: string[] }>();
  const groupKey = (recipient: NotificationRecipient) => `${recipient.role}:${recipient.teacherId ?? ""}`;

  const sendEmail = deps.sendEmail;
  await Promise.all(
    recipients.map(async (recipient) => {
      if (
        sendEmail &&
        recipient.email &&
        canReceiveNotification(recipient.role, "morningEmail") &&
        recipient.preferences.morningEmail
      ) {
        const to = recipient.email;
        await sendOnce(deps, result, academyId, today, recipient.userId, "email", async () => {
          const brief = await once(briefs, groupKey(recipient), async () => {
            const built = buildMorningBrief(await inputFor(recipient));
            return { ...built, ...(await deps.renderEmail(built)) };
          });
          const { id } = await sendEmail({ to, subject: brief.subject, html: brief.html, text: brief.text });
          result.emails += 1;
          return id;
        });
      }

      if (canReceiveNotification(recipient.role, "pushMorningBrief") && recipient.preferences.pushMorningBrief) {
        if (await deps.claim(academyId, today, recipient.userId, "push")) {
          const group = pushGroups.get(groupKey(recipient)) ?? { input: inputFor(recipient), userIds: [] };
          group.userIds.push(recipient.userId);
          pushGroups.set(groupKey(recipient), group);
        } else {
          result.skipped += 1;
        }
      }
    }),
  );

  // 같은 역할·선생님은 같은 문구라 한 번에 보낸다.
  await Promise.all(
    [...pushGroups.values()].map(async (group) => {
      let error: string | null = null;
      try {
        const summary = await deps.deliverPush({
          academyId,
          userIds: group.userIds,
          payload: buildMorningBriefPush(await group.input),
        });
        result.pushes += summary.sent;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
        for (const userId of group.userIds) {
          result.failures.push({ academyId, userId, channel: "push", error });
        }
      }
      await Promise.all(group.userIds.map((userId) => deps.finish(academyId, today, userId, "push", null, error)));
    }),
  );
}

async function sendOnce(
  deps: MorningBriefJobDependencies,
  result: MorningBriefJobResult,
  academyId: string,
  today: string,
  userId: string,
  channel: Channel,
  send: () => Promise<string | null>,
) {
  if (!(await deps.claim(academyId, today, userId, channel))) {
    result.skipped += 1;
    return;
  }

  try {
    const providerId = await send();
    await deps.finish(academyId, today, userId, channel, providerId, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.failures.push({ academyId, userId, channel, error: message });
    await deps.finish(academyId, today, userId, channel, null, message);
  }
}
