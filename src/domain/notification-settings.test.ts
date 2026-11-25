import { describe, expect, it } from "vitest";

import {
  detectInstallGuide,
  detectPushSupport,
  getNotificationSettingItems,
} from "./notification-settings";

describe("getNotificationSettingItems", () => {
  it("원장은 아침 메일과 푸시 네 가지를 모두 설정한다", () => {
    expect(getNotificationSettingItems("owner").map((item) => item.key)).toEqual([
      "morningEmail",
      "pushLessonChange",
      "pushConsultation",
      "pushJoinRequest",
      "pushMorningBrief",
    ]);
  });

  it("데스크는 가입 요청 알림이 없다(승인은 원장만 한다)", () => {
    expect(getNotificationSettingItems("desk").map((item) => item.key)).toEqual([
      "morningEmail",
      "pushLessonChange",
      "pushConsultation",
      "pushMorningBrief",
    ]);
  });

  it("선생님은 아침 메일·상담·가입 요청 없이 담당 레슨 변경과 아침 브리핑 푸시만 설정한다", () => {
    expect(getNotificationSettingItems("teacher").map((item) => item.key)).toEqual([
      "pushLessonChange",
      "pushMorningBrief",
    ]);
  });
});

const supportedEnvironment = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default" as NotificationPermission,
  isIos: false,
  isStandalone: false,
};

describe("detectPushSupport", () => {
  it("푸시를 지원하고 아직 묻지 않았으면 켤 수 있다", () => {
    expect(detectPushSupport(supportedEnvironment)).toBe("can-enable");
  });

  it("아이폰은 홈 화면에 추가한 앱에서만 푸시를 켤 수 있다", () => {
    expect(detectPushSupport({ ...supportedEnvironment, isIos: true, hasPushManager: false })).toBe(
      "ios-needs-install",
    );
    expect(detectPushSupport({ ...supportedEnvironment, isIos: true, isStandalone: true })).toBe("can-enable");
  });

  it("권한을 거절했으면 브라우저 설정에서 풀어야 한다", () => {
    expect(detectPushSupport({ ...supportedEnvironment, permission: "denied" })).toBe("denied");
  });

  it("허용했으면 구독 여부와 상관없이 granted로 본다", () => {
    expect(detectPushSupport({ ...supportedEnvironment, permission: "granted" })).toBe("granted");
  });

  it("서비스 워커나 푸시를 지원하지 않는 브라우저는 지원하지 않음", () => {
    expect(detectPushSupport({ ...supportedEnvironment, hasServiceWorker: false })).toBe("unsupported");
  });
});

describe("detectInstallGuide", () => {
  it("이미 설치한 앱으로 열었으면 안내하지 않는다", () => {
    expect(detectInstallGuide({ isIos: true, isStandalone: true, canPromptInstall: false })).toBe("installed");
  });

  it("아이폰·아이패드는 공유 → 홈 화면에 추가 안내", () => {
    expect(detectInstallGuide({ isIos: true, isStandalone: false, canPromptInstall: false })).toBe("ios");
  });

  it("설치 창을 띄울 수 있는 브라우저는 설치 버튼, 아니면 브라우저 메뉴 안내", () => {
    expect(detectInstallGuide({ isIos: false, isStandalone: false, canPromptInstall: true })).toBe("prompt");
    expect(detectInstallGuide({ isIos: false, isStandalone: false, canPromptInstall: false })).toBe("browser-menu");
  });
});
