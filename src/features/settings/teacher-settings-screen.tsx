"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListStatusAlert } from "@/components/management/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { archiveTeacherMessageTemplate, fetchTeacherMessageTemplates, saveTeacherMessageTemplate, type TeacherMessageTemplateClient } from "@/lib/api/teacher-message-templates";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TeacherMessageTemplatesForm } from "./teacher-message-templates-form";

export function TeacherSettingsScreen({ academyId }: { academyId: string }) {
  const queryClient = useQueryClient();
  const clientState = useMemo(() => {
    try { return { client: createSupabaseBrowserClient() as unknown as TeacherMessageTemplateClient, error: null }; }
    catch (error) { return { client: null, error }; }
  }, []);
  const key = [...queryKeys.academy(academyId), "teacher-message-templates"];
  const query = useQuery({ queryKey: key, queryFn: () => fetchTeacherMessageTemplates(clientState.client!, academyId), enabled: Boolean(clientState.client) });
  const save = useMutation({
    mutationFn: (input: { id?: string; title: string; content: string }) => saveTeacherMessageTemplate(clientState.client!, { ...input, academyId }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: key }); toast.success("템플릿을 저장했습니다."); },
    onError: (error) => toast.error("템플릿 저장에 실패했습니다.", { description: toUserMessage(error) }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveTeacherMessageTemplate(clientState.client!, { academyId, id }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: key }); toast.success("템플릿을 삭제했습니다."); },
    onError: (error) => toast.error("템플릿 삭제에 실패했습니다.", { description: toUserMessage(error) }),
  });
  const error = clientState.error ?? query.error;
  return <section aria-label="선생님 설정" className="grid gap-4"><SectionCard className="grid gap-4">
    <SectionHeader title="선생님 설정" description="선생님 관련 운영 설정을 관리합니다." />
    {error ? <ListStatusAlert message="선생님 설정을 불러오지 못했습니다." detail={toUserMessage(error)} /> : null}
    {query.isLoading ? <EmptyState>설정을 불러오는 중입니다.</EmptyState> : null}
    {query.isSuccess ? <TeacherMessageTemplatesForm templates={query.data} isSaving={save.isPending || archive.isPending}
      onSave={async (input) => { try { return await save.mutateAsync(input); } catch { return undefined; } }}
      onArchive={async (id) => { try { await archive.mutateAsync(id); return true; } catch { return false; } }} /> : null}
  </SectionCard></section>;
}
