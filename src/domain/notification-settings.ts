import type { AcademyRole } from "./permissions";

export type NotificationPreferences = {
  morningEmail: boolean;
  pushLessonChange: boolean;
  pushConsultation: boolean;
  pushJoinRequest: boolean;
  pushMorningBrief: boolean;
};

export type NotificationPreferenceKey = keyof NotificationPreferences;

export type NotificationSettingItem = {
  key: NotificationPreferenceKey;
  channel: "email" | "push";
  label: string;
  description: string;
  roles: AcademyRole[];
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  morningEmail: true,
  pushLessonChange: true,
  pushConsultation: true,
  pushJoinRequest: true,
  pushMorningBrief: true,
};

/** 설정 화면에 보이는 항목과 받을 수 있는 역할. 발송 대상 판단(`notification-dispatch.ts`)도 이 역할을 따른다. */
export const NOTIFICATION_SETTING_ITEMS: NotificationSettingItem[] = [
  {
    key: "morningEmail",
    channel: "email",
    label: "아침 브리핑 메일",
    description: "매일 오전 8시에 오늘 레슨과 챙길 일을 메일로 받습니다.",
    roles: ["owner", "desk"],
  },
  {
    key: "pushLessonChange",
    channel: "push",
    label: "레슨 변경(오늘·내일)",
    description: "오늘·내일 레슨이 옮겨지거나 취소되거나 선생님이 바뀌면 바로 알려 드립니다. 내가 바꾼 것은 알리지 않습니다.",
    roles: ["owner", "desk", "teacher"],
  },
  {
    key: "pushConsultation",
    channel: "push",
    label: "신규 상담 접수",
    description: "새 상담이 등록되면 알려 드립니다.",
    roles: ["owner", "desk"],
  },
  {
    key: "pushJoinRequest",
    channel: "push",
    label: "직원 가입 요청",
    description: "선생님·데스크가 가입을 요청하면 승인할 수 있게 알려 드립니다.",
    roles: ["owner"],
  },
  {
    key: "pushMorningBrief",
    channel: "push",
    label: "아침 브리핑 한 줄",
    description: "오전 8시에 오늘 할 일(선생님은 오늘 내 레슨) 건수를 알려 드립니다.",
    roles: ["owner", "desk", "teacher"],
  },
];

export function getNotificationSettingItems(role: AcademyRole) {
  return NOTIFICATION_SETTING_ITEMS.filter((item) => item.roles.includes(role));
}

/** 이 역할이 이 알림을 받을 수 있는지. 설정 화면과 발송이 같은 역할 목록을 쓴다. */
export function canReceiveNotification(role: AcademyRole, key: NotificationPreferenceKey) {
  return NOTIFICATION_SETTING_ITEMS.some((item) => item.key === key && item.roles.includes(role));
}

export type PushEnvironment = {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission;
  isIos: boolean;
  /** 홈 화면에 설치한 앱으로 열었는지. */
  isStandalone: boolean;
};

export type PushSupport = "unsupported" | "ios-needs-install" | "denied" | "can-enable" | "granted";

/** 이 기기에서 푸시를 켤 수 있는지. iOS는 홈 화면에 추가한 앱에서만 푸시를 쓸 수 있다. */
export function detectPushSupport(environment: PushEnvironment): PushSupport {
  if (environment.isIos && !environment.isStandalone) {
    return "ios-needs-install";
  }

  if (!environment.hasServiceWorker || !environment.hasPushManager || !environment.hasNotification) {
    return "unsupported";
  }

  if (environment.permission === "denied") {
    return "denied";
  }

  return environment.permission === "granted" ? "granted" : "can-enable";
}

export type InstallGuide = "installed" | "ios" | "prompt" | "browser-menu";

export function detectInstallGuide(input: {
  isIos: boolean;
  isStandalone: boolean;
  /** 브라우저가 설치 창(beforeinstallprompt)을 준비했는지. */
  canPromptInstall: boolean;
}): InstallGuide {
  if (input.isStandalone) {
    return "installed";
  }

  if (input.isIos) {
    return "ios";
  }

  return input.canPromptInstall ? "prompt" : "browser-menu";
}
