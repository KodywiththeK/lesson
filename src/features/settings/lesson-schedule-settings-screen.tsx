"use client";

import { useMemo } from "react";
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
  type SaveAcademyClosureInput,
} from "@/lib/api/lesson-calendar-settings";
import { fetchPrivateLessonRegistrationOptions, type PrivateLessonRegistrationOptionsSupabaseClient } from "@/lib/api/private-lessons";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { LessonScheduleSettingsForm } from "./lesson-schedule-settings-form";

type SettingsClient = LessonCalendarSettingsClient & PrivateLessonRegistrationOptionsSupabaseClient;

export function LessonScheduleSettingsScreen({
  academyId,
  demoInstruments,
}: {
  academyId: string;
  demoInstruments?: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
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
  const instruments = demoInstruments ?? [...new Map(
    (instrumentQuery.data?.students ?? []).flatMap((student) =>
      student.instruments.map((item) => [item.instrumentId, { id: item.instrumentId, name: item.instrumentName }] as const),
    ),
  ).values()];
  const saveColor = useMutation({
    mutationFn: async ({ instrumentId, color }: { instrumentId: string; color: string }) => {
      if (!client) throw new Error("학원 설정 연결을 확인해 주세요.");
      await saveAcademyInstrumentColor(client, academyId, instrumentId, color);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: colorKey });
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
      void queryClient.invalidateQueries({ queryKey: closureKey });
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
      void queryClient.invalidateQueries({ queryKey: closureKey });
      toast.success("휴원일을 해제했습니다.");
    },
    onError: (error) => toast.error("휴원일 해제에 실패했습니다.", { description: toUserMessage(error) }),
  });
  const queryError = clientState.error ?? instrumentQuery.error ?? colorQuery.error ?? closureQuery.error;

  return <section aria-label="레슨시간표 설정" className="grid gap-4">
    <SectionCard className="grid gap-4">
      <SectionHeader title="레슨시간표 설정" description="악기 색상과 학원 공통 휴원일을 설정합니다. 휴원일의 기존 수업은 그대로 남습니다." />
      {queryError ? <ListStatusAlert message="시간표 설정을 불러오지 못했습니다." detail={toUserMessage(queryError)} /> : null}
      <LessonScheduleSettingsForm
        instruments={instruments}
        colors={colorQuery.data ?? []}
        closures={closureQuery.data ?? []}
        isSaving={Boolean(queryError) || saveColor.isPending || saveClosure.isPending || archiveClosure.isPending}
        onSaveColor={(instrumentId, color) => saveColor.mutate({ instrumentId, color })}
        onSaveClosure={(input) => saveClosure.mutate({ ...input, academyId })}
        onArchiveClosure={(id) => archiveClosure.mutate(id)}
      />
    </SectionCard>
  </section>;
}
