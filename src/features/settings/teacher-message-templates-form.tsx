"use client";

import { useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PAYROLL_MESSAGE_TEMPLATE, PAYROLL_MESSAGE_FIELDS, renderPayrollMessage, validatePayrollTemplate } from "@/domain/payroll-message";
import type { TeacherMessageTemplate } from "@/lib/api/teacher-message-templates";

export function TeacherMessageTemplatesForm({ templates, isSaving, onSave, onArchive }: {
  templates: TeacherMessageTemplate[]; isSaving: boolean;
  onSave: (input: { id?: string; title: string; content: string }) => Promise<TeacherMessageTemplate | undefined>;
  onArchive: (id: string) => Promise<boolean>;
}) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("기본 정산 안내");
  const [content, setContent] = useState(DEFAULT_PAYROLL_MESSAGE_TEMPLATE);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const archiveInFlight = useRef(false);
  const unsupported = validatePayrollTemplate(content);
  const canSave = Boolean(title.trim() && content.trim() && title.length <= 100 && content.length <= 10000 && !unsupported.length && !isSaving);
  const choose = (nextId: string) => {
    const template = templates.find((item) => item.id === nextId);
    setId(nextId);
    setTitle(template?.title ?? "기본 정산 안내");
    setContent(template?.content ?? DEFAULT_PAYROLL_MESSAGE_TEMPLATE);
  };
  return <section className="grid gap-4" aria-label="정산 문자 템플릿">
    <h2 className="font-semibold">정산 문자 템플릿</h2>
    <Label className="grid gap-1">템플릿 선택
      <NativeSelect aria-label="템플릿 선택" value={id} onChange={(event) => choose(event.target.value)}>
        <NativeSelectOption value="">기본 템플릿 (새로 저장)</NativeSelectOption>
        {templates.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.title}</NativeSelectOption>)}
      </NativeSelect>
    </Label>
    <Label className="grid gap-1">템플릿 이름<Input aria-label="템플릿 이름" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} /></Label>
    <Label className="grid gap-1">템플릿 내용<Textarea aria-label="템플릿 내용" value={content} maxLength={10000} className="min-h-56" onChange={(event) => setContent(event.target.value)} /></Label>
    <p className="text-sm text-muted-foreground">사용 가능한 변수: {PAYROLL_MESSAGE_FIELDS.map((field) => `{${field}}`).join(" · ")}</p>
    {unsupported.length ? <p role="alert" className="text-sm text-destructive">지원하지 않는 변수: {unsupported.join(", ")}</p> : null}
    {!unsupported.length ? <div className="grid min-w-0 gap-1"><strong className="text-sm">미리보기</strong>
      <pre className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md border p-3 text-sm">{renderPayrollMessage(content, {
        선생님: "홍길동", 월: "10", 악기: "바이올린", 수업횟수: "12", 정산총액: "256,500",
        원천징수액: "8,464", 실수령액: "248,036", 학생별내역: "- 원생별 내역",
      })}</pre></div> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={!canSave} onClick={() => void onSave({ id: id || undefined, title: title.trim(), content }).then((saved) => { if (saved) setId(saved.id); })}>템플릿 저장</Button>
      {id ? <Button type="button" variant="outline" disabled={isSaving} onClick={() => setConfirmDelete(true)}>템플릿 삭제</Button> : null}
    </div>
    <AlertDialog open={confirmDelete} onOpenChange={(open) => { if (!isSaving) setConfirmDelete(open); }}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>템플릿을 삭제할까요?</AlertDialogTitle><AlertDialogDescription>저장된 템플릿이 목록에서 사라집니다.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={isSaving}>취소</AlertDialogCancel><AlertDialogAction disabled={isSaving} onClick={(event) => {
        event.preventDefault();
        if (archiveInFlight.current) return;
        archiveInFlight.current = true;
        void onArchive(id).then((success) => { if (success) { setConfirmDelete(false); choose(""); } })
          .finally(() => { archiveInFlight.current = false; });
      }}>삭제</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </section>;
}
