"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PAYROLL_MESSAGE_TEMPLATE, renderPayrollMessage, type PayrollMessageValues } from "@/domain/payroll-message";
import type { TeacherMessageTemplate } from "@/lib/api/teacher-message-templates";

export function PayrollMessageDialog({ open, onOpenChange, templates, values, detailWarning, templateWarning }: {
  open: boolean; onOpenChange: (open: boolean) => void; templates: TeacherMessageTemplate[];
  values: PayrollMessageValues; detailWarning?: string; templateWarning?: string;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>정산 문자 작성</DialogTitle><DialogDescription>내용을 확인하고 복사해 문자나 메신저에 붙여 넣으세요.</DialogDescription></DialogHeader>
    {templateWarning ? <p role="alert" className="text-sm text-destructive">{templateWarning}</p> : null}
    <PayrollMessageForm templates={templates} values={values} detailWarning={detailWarning} />
  </DialogContent></Dialog>;
}

function PayrollMessageForm({ templates, values, detailWarning }: {
  templates: TeacherMessageTemplate[]; values: PayrollMessageValues; detailWarning?: string;
}) {
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState(() => renderPayrollMessage(DEFAULT_PAYROLL_MESSAGE_TEMPLATE, values));
  const [copyFailed, setCopyFailed] = useState(false);
  return <div className="grid gap-3">
    <Label className="grid gap-1">템플릿
      <NativeSelect aria-label="문자 템플릿" value={selected} onChange={(event) => {
        const id = event.target.value;
        setSelected(id);
        setContent(renderPayrollMessage(templates.find((item) => item.id === id)?.content ?? DEFAULT_PAYROLL_MESSAGE_TEMPLATE, values));
      }}>
        <NativeSelectOption value="">기본 정산 안내</NativeSelectOption>
        {templates.map((template) => <NativeSelectOption key={template.id} value={template.id}>{template.title}</NativeSelectOption>)}
      </NativeSelect>
    </Label>
    {detailWarning ? <p role="status" className="text-sm text-muted-foreground">{detailWarning}</p> : null}
    <Label className="grid gap-1">문자 내용<Textarea aria-label="정산 문자 내용" value={content} onChange={(event) => setContent(event.target.value)} className="min-h-64" /></Label>
    {copyFailed ? <p role="alert" className="text-sm text-destructive">복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.</p> : null}
    <DialogFooter><Button type="button" disabled={!content.trim()} onClick={async () => {
      try { await navigator.clipboard.writeText(content); setCopyFailed(false); toast.success("정산 문자를 복사했습니다."); }
      catch { setCopyFailed(true); }
    }}>복사</Button></DialogFooter>
  </div>;
}
