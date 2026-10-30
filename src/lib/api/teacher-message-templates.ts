import { fetchAllRows, type PagedSelectQuery } from "./paged-query";

export type TeacherMessageTemplate = { id: string; title: string; content: string; active: boolean };
type TemplateResult = { data: TeacherMessageTemplate | null; error: Error | null };
export type TeacherMessageTemplateClient = {
  from(table: "teacher_message_templates"): { select(columns: string): PagedSelectQuery<TeacherMessageTemplate> };
  rpc(name: "save_teacher_message_template" | "archive_teacher_message_template", payload: Record<string, unknown>): PromiseLike<TemplateResult>;
};

export async function fetchTeacherMessageTemplates(client: TeacherMessageTemplateClient, academyId: string) {
  return fetchAllRows("문자 템플릿을 불러오지 못했습니다", (from, to) => client.from("teacher_message_templates")
    .select("id,title,content,active").eq("academy_id", academyId).eq("active", true).order("created_at").order("id").range(from, to));
}

export async function saveTeacherMessageTemplate(client: Pick<TeacherMessageTemplateClient, "rpc">, input: {
  academyId: string; id?: string; title: string; content: string;
}) {
  const { data, error } = await client.rpc("save_teacher_message_template", {
    p_academy_id: input.academyId, p_id: input.id ?? null, p_title: input.title, p_content: input.content,
  });
  if (error) throw new Error(`문자 템플릿을 저장하지 못했습니다: ${error.message}`);
  if (!data) throw new Error("저장한 문자 템플릿을 확인할 수 없습니다.");
  return data;
}

export async function archiveTeacherMessageTemplate(client: Pick<TeacherMessageTemplateClient, "rpc">, input: {
  academyId: string; id: string;
}) {
  const { error } = await client.rpc("archive_teacher_message_template", { p_academy_id: input.academyId, p_id: input.id });
  if (error) throw new Error(`문자 템플릿을 삭제하지 못했습니다: ${error.message}`);
}
