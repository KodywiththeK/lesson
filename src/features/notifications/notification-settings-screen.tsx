"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  detectInstallGuide,
  detectPushSupport,
  getNotificationSettingItems,
  type InstallGuide,
  type NotificationPreferences,
  type PushEnvironment,
  type PushSupport,
} from "@/domain/notification-settings";
import type { AcademyRole } from "@/domain/permissions";
import type { MyNotificationSettings, PushSubscriptionKeys } from "@/lib/api/notification-settings";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";

export type NotificationSettingsDataAccess = {
  loadSettings: () => Promise<MyNotificationSettings>;
  savePreferences: (preferences: NotificationPreferences) => Promise<void>;
  saveSubscription: (subscription: PushSubscriptionKeys) => Promise<void>;
  deleteSubscription: (endpoint: string) => Promise<void>;
  sendTest: () => Promise<void>;
};

/** 이 브라우저(기기)의 푸시 기능. 화면 테스트에서는 가짜로 바꾼다. */
export type NotificationDevice = {
  readEnvironment: () => PushEnvironment;
  getEndpoint: () => Promise<string | null>;
  subscribe: () => Promise<PushSubscriptionKeys>;
  unsubscribe: () => Promise<string | null>;
};

type NotificationSettingsScreenProps = {
  academyId: string;
  role: AcademyRole;
  dataAccess: NotificationSettingsDataAccess;
  device: NotificationDevice;
};

const PUSH_SUPPORT_MESSAGES: Record<Exclude<PushSupport, "can-enable" | "granted">, string> = {
  unsupported: "이 브라우저는 알림을 지원하지 않습니다. 크롬·사파리 최신 버전에서 열어 주세요.",
  "ios-needs-install":
    "아이폰·아이패드는 홈 화면에 추가한 앱에서만 알림을 받을 수 있습니다. 아래 '앱 설치' 안내대로 추가한 뒤 그 앱에서 이 화면을 열어 주세요.",
  denied: "알림이 차단되어 있습니다. 브라우저(또는 기기) 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어 주세요.",
};

export function NotificationSettingsScreen({ academyId, role, dataAccess, device }: NotificationSettingsScreenProps) {
  // 기기 상태는 브라우저에서만 읽을 수 있어 query로 한 번 읽어 두 구획이 나눠 쓴다(서버 렌더 때는 '확인 중').
  const deviceQuery = useQuery({
    queryKey: queryKeys.notifications.device(),
    queryFn: async () => {
      const environment = device.readEnvironment();
      return { environment, support: detectPushSupport(environment), endpoint: await device.getEndpoint() };
    },
  });

  return (
    <div className="grid gap-4">
      <DevicePushSection dataAccess={dataAccess} device={device} state={deviceQuery.data} />
      <PreferenceSection academyId={academyId} role={role} dataAccess={dataAccess} />
      <InstallSection environment={deviceQuery.data?.environment} />
    </div>
  );
}

type DeviceState = { environment: PushEnvironment; support: PushSupport; endpoint: string | null };

function DevicePushSection({
  dataAccess,
  device,
  state,
}: {
  dataAccess: NotificationSettingsDataAccess;
  device: NotificationDevice;
  state: DeviceState | undefined;
}) {
  const queryClient = useQueryClient();
  const refreshDevice = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.device() });
  const enableMutation = useMutation({
    mutationFn: async () => dataAccess.saveSubscription(await device.subscribe()),
    onSuccess: () => toast.success("이 기기에서 알림을 받습니다."),
    onError: (error) => toast.error(toUserMessage(error)),
    onSettled: refreshDevice,
  });
  const disableMutation = useMutation({
    mutationFn: async () => {
      const endpoint = await device.unsubscribe();
      if (endpoint) {
        await dataAccess.deleteSubscription(endpoint);
      }
    },
    onSuccess: () => toast.success("이 기기 알림을 껐습니다."),
    onError: (error) => toast.error(toUserMessage(error)),
    onSettled: refreshDevice,
  });
  const testMutation = useMutation({
    mutationFn: dataAccess.sendTest,
    onSuccess: () => toast.success("테스트 알림을 보냈습니다. 잠시 뒤 이 기기에 알림이 옵니다."),
    onError: (error) => toast.error(toUserMessage(error)),
  });
  const support = state?.support;
  const isSubscribed = Boolean(state?.endpoint);
  const isBusy = enableMutation.isPending || disableMutation.isPending;

  return (
    <SectionCard role="region" aria-labelledby="device-push-heading" className="gap-3">
      <SectionHeader headingId="device-push-heading" title="이 기기 알림" description="휴대폰·컴퓨터마다 따로 켭니다." />
      {support === undefined ? (
        <EmptyState role="status">이 기기의 알림 상태를 확인하는 중입니다.</EmptyState>
      ) : support === "can-enable" || support === "granted" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" role="status">
            {isSubscribed ? "이 기기에서 알림을 받고 있습니다." : "이 기기는 아직 알림을 받지 않습니다."}
          </p>
          <div className="flex flex-wrap gap-2">
            {isSubscribed ? (
              <>
                <Button variant="outline" size="sm" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
                  테스트 알림 보내기
                </Button>
                <Button variant="outline" size="sm" disabled={isBusy} onClick={() => disableMutation.mutate()}>
                  이 기기 알림 끄기
                </Button>
              </>
            ) : (
              <Button size="sm" disabled={isBusy} onClick={() => enableMutation.mutate()}>
                이 기기에서 알림 켜기
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          {PUSH_SUPPORT_MESSAGES[support]}
        </p>
      )}
    </SectionCard>
  );
}

function PreferenceSection({
  academyId,
  role,
  dataAccess,
}: {
  academyId: string;
  role: AcademyRole;
  dataAccess: NotificationSettingsDataAccess;
}) {
  const queryClient = useQueryClient();
  const settingsQueryKey = queryKeys.notifications.mySettings(academyId);
  const settingsQuery = useQuery({ queryKey: settingsQueryKey, queryFn: dataAccess.loadSettings });
  const saveMutation = useMutation({
    mutationFn: (preferences: NotificationPreferences) => dataAccess.savePreferences(preferences),
    onMutate: (preferences) => {
      const previous = queryClient.getQueryData<MyNotificationSettings>(settingsQueryKey);
      if (previous) {
        queryClient.setQueryData(settingsQueryKey, { ...previous, preferences });
      }
      return { previous };
    },
    onError: (error, _preferences, context) => {
      if (context?.previous) {
        queryClient.setQueryData(settingsQueryKey, context.previous);
      }
      toast.error(toUserMessage(error));
    },
  });
  const items = getNotificationSettingItems(role);
  const settings = settingsQuery.data;

  return (
    <SectionCard role="region" aria-labelledby="preference-heading" className="gap-3">
      <SectionHeader headingId="preference-heading" title="받을 알림" description="바꾸면 바로 저장됩니다." />
      {settingsQuery.error ? (
        <EmptyState role="alert">{toUserMessage(settingsQuery.error)}</EmptyState>
      ) : !settings ? (
        <EmptyState role="status">알림 설정을 불러오는 중입니다.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.label}
                  <span className="ml-2 text-xs text-muted-foreground">{item.channel === "email" ? "메일" : "푸시"}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                {item.channel === "email" ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    받는 주소: {settings.email ?? "로그인 계정에 이메일이 없습니다"}
                  </p>
                ) : null}
              </div>
              <Switch
                aria-label={item.label}
                checked={settings.preferences[item.key]}
                onCheckedChange={(checked) => saveMutation.mutate({ ...settings.preferences, [item.key]: checked })}
              />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function InstallSection({ environment }: { environment: PushEnvironment | undefined }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);

    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const guide = environment
    ? detectInstallGuide({
        isIos: environment.isIos,
        isStandalone: environment.isStandalone,
        canPromptInstall: installEvent !== null,
      })
    : null;

  return (
    <SectionCard role="region" aria-labelledby="install-heading" className="gap-3">
      <SectionHeader
        headingId="install-heading"
        title="앱 설치"
        description="홈 화면에 앱으로 설치하면 주소창 없이 열리고 알림을 더 잘 받습니다."
      />
      <InstallGuideText guide={guide} onInstall={() => void installEvent?.prompt()} />
    </SectionCard>
  );
}

function InstallGuideText({ guide, onInstall }: { guide: InstallGuide | null; onInstall: () => void }) {
  if (guide === null) {
    return null;
  }

  if (guide === "installed") {
    return <p className="text-sm">이미 앱으로 설치해 쓰고 있습니다.</p>;
  }

  if (guide === "ios") {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>사파리 아래쪽(아이패드는 위쪽)의 공유 버튼을 누릅니다.</li>
        <li>목록에서 &lsquo;홈 화면에 추가&rsquo;를 누르고 &lsquo;추가&rsquo;를 누릅니다.</li>
        <li>홈 화면의 마디마디 앱으로 열어 이 화면에서 &lsquo;이 기기에서 알림 켜기&rsquo;를 누릅니다.</li>
      </ol>
    );
  }

  if (guide === "prompt") {
    return (
      <div>
        <Button size="sm" onClick={onInstall}>
          앱 설치하기
        </Button>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      크롬 주소창 오른쪽의 설치 아이콘 또는 메뉴(⋮)의 &lsquo;앱 설치&rsquo;·&lsquo;홈 화면에 추가&rsquo;를 눌러 설치할 수 있습니다.
    </p>
  );
}
