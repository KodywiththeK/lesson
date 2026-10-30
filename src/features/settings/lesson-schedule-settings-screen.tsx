"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import {
  archiveAcademyClosure,
  fetchAcademyClosures,
  fetchAcademyInstrumentColors,
  saveAcademyClosure,
  saveAcademyInstrumentColor,
  type LessonCalendarSettingsClient,
  type AcademyInstrumentColor,
  type SaveAcademyClosureInput,
} from "@/lib/api/lesson-calendar-settings";
import { fetchPrivateLessonRegistrationOptions, type PrivateLessonRegistrationOptionsSupabaseClient } from "@/lib/api/private-lessons";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAcademyHolidayPolicy, saveAcademyHolidayPolicy, type AcademyHolidayPolicy, type AcademyHolidayPolicyClient } from "@/lib/api/academy-holiday-policy";

import { LessonScheduleSettingsForm } from "./lesson-schedule-settings-form";

type SettingsClient = LessonCalendarSettingsClient & PrivateLessonRegistrationOptionsSupabaseClient;

export function LessonScheduleSettingsScreen({
  academyId,
  demoInstruments,
  demoColors,
  onSaveDemoColor,
}: {
  academyId: string;
  demoInstruments?: Array<{ id: string; name: string }>;
  demoColors?: AcademyInstrumentColor[];
  onSaveDemoColor?: (instrumentId: string, color: string) => void;
}) {
  const queryClient = useQueryClient();
  const [demoHolidayPolicy, setDemoHolidayPolicy] = useState<AcademyHolidayPolicy>({
    excludePublicHolidays: true, excludeAcademyClosures: true,
  });
  const clientState = useMemo(() => {
    if (demoInstruments) return { client: null, error: null };
    try {
      return { client: createSupabaseBrowserClient() as unknown as SettingsClient, error: null };
    } catch (error) {
      return { client: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }, [demoInstruments]);
  const client = clientState.client;
  const colorKey = [...queryKeys.academy(academyId), "instrument-colors"];
  const closureKey = [...queryKeys.academy(academyId), "closures"];
  const policyKey = [...queryKeys.academy(academyId), "holiday-policy"];
  const instrumentQuery = useQuery({
    queryKey: queryKeys.privateLessons.registrationOptions(academyId),
    queryFn: () => fetchPrivateLessonRegistrationOptions(client!, academyId),
    enabled: Boolean(client),
  });
  const colorQuery = useQuery({
    queryKey: colorKey,
    queryFn: () => fetchAcademyInstrumentColors(client!, academyId),
    enabled: Boolean(client),
  });
  const closureQuery = useQuery({
    queryKey: closureKey,
    queryFn: () => fetchAcademyClosures(client!, academyId),
    enabled: Boolean(client),
  });
  const policyQuery = useQuery({
    queryKey: policyKey,
    queryFn: () => fetchAcademyHolidayPolicy(client as unknown as AcademyHolidayPolicyClient, academyId),
    enabled: Boolean(client),
  });
  const savePolicy = useMutation({
    mutationFn: async (policy: AcademyHolidayPolicy) => {
      if (demoInstruments) {
        setDemoHolidayPolicy(policy);
        return;
      }
      if (!client) throw new Error("학원 설정 연결을 확인해 주세요.");
      await saveAcademyHolidayPolicy(client as unknown as AcademyHolidayPolicyClient, academyId, policy);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.academy(academyId) });
      toast.success("쉬는 날 설정을 저장했습니다.");
    },
    onError: (error) => toast.error("쉬는 날 설정을 저장하지 못했습니다.", { description: toUserMessage(error) }),
  });
  const instruments = demoInstruments ?? [...new Map(
    (instrumentQuery.data?.students ?? []).flatMap((student) =>
      student.instruments.map((item) => [item.instrumentId, { id: item.instrumentId, name: item.instrumentName }] as const),
    ),
  ).values()];
  const saveColor = useMutation({
    mutationFn: async ({ instrumentId, color }: { instrumentId: string; color: string }) => {
      if (!client) {
        if (!onSaveDemoColor) throw new Error("학원 설정 연결을 확인해 주세요.");
        onSaveDemoColor(instrumentId, color);
        return;
      }
      await saveAcademyInstrumentColor(client, academyId, instrumentId, color);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: colorKey });
      toast.success("악기 색상을 저장했습니다.");
    },
    onError: (error) => toast.error("악기 색상 저장에 실패했습니다.", { description: toUserMessage(error) }),
  });
  const saveClosure = useMutation({
    mutationFn: async (input: SaveAcademyClosureInput) => {
      if (!client) throw new Error("학원 설정 연결을 확인해 주세요.");
      await saveAcademyClosure(client, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academy(academyId) });
      toast.success("휴원일을 저장했습니다.");
    },
    onError: (error) => toast.error("휴원일 저장에 실패했습니다.", { description: toUserMessage(error) }),
  });
  const archiveClosure = useMutation({
    mutationFn: async (id: string) => {
      if (!client) throw new Error("학원 설정 연결을 확인해 주세요.");
      await archiveAcademyClosure(client, academyId, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academy(academyId) });
      toast.success("휴원일을 해제했습니다.");
    },
    onError: (error) => toast.error("휴원일 해제에 실패했습니다.", { description: toUserMessage(error) }),
  });
  const queryError = clientState.error ?? instrumentQuery.error ?? colorQuery.error ?? closureQuery.error ?? policyQuery.error;

  return <section aria-label="레슨시간표 설정" className="grid gap-4">
    <SectionCard className="grid gap-4">
      <SectionHeader title="레슨시간표 설정" description="악기 색상과 정기 수업의 쉬는 날, 학원 공통 휴원일을 설정합니다." />
      {demoInstruments ? <p className="text-sm text-muted-foreground">데모의 쉬는 날 설정은 현재 화면에서만 유지됩니다.</p> : null}
      {queryError ? <ListStatusAlert message="시간표 설정을 불러오지 못했습니다." detail={toUserMessage(queryError)} /> : null}
      <LessonScheduleSettingsForm
        instruments={instruments}
        colors={demoColors ?? colorQuery.data ?? []}
        closures={closureQuery.data ?? []}
        isSaving={Boolean(queryError) || saveColor.isPending || saveClosure.isPending || archiveClosure.isPending || savePolicy.isPending}
        holidayPolicy={demoInstruments ? demoHolidayPolicy : policyQuery.data}
        onSaveHolidayPolicy={(policy) => savePolicy.mutate(policy)}
        onSaveColor={(instrumentId, color) => saveColor.mutate({ instrumentId, color })}
        onSaveClosure={(input) => saveClosure.mutate({ ...input, academyId })}
        onArchiveClosure={(id) => archiveClosure.mutate(id)}
      />
    </SectionCard>
  </section>;
}
