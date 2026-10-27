"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import { paginateItems } from "@/domain/common-list";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createInvite, listAvailableTeacherRecords, listInvites, listOwnerJoinRequests,
  listStaff, reviewJoinRequest, revokeInvite, rotateJoinCode, setStaffActive,
  setStaffRole, type AvailableTeacherRecord, type OwnerJoinRequest, type StaffMember,
} from "@/lib/api/academy-onboarding";
import { toUserMessage } from "@/lib/errors/user-message";

type StaffRole = "desk" | "teacher";

export function OwnerMembersScreen({ academyId }: { academyId: string }) {
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ["academy", academyId, "join-requests"], queryFn: () => listOwnerJoinRequests(academyId), retry: false });
  const staff = useQuery({ queryKey: ["academy", academyId, "staff"], queryFn: () => listStaff(academyId), retry: false });
  const invites = useQuery({ queryKey: ["academy", academyId, "invites"], queryFn: () => listInvites(academyId), retry: false });
  const teachers = useQuery({ queryKey: ["academy", academyId, "unlinked-teachers"], queryFn: () => listAvailableTeacherRecords(academyId), retry: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [newInvite, setNewInvite] = useState<string | null>(null);
  const requestPaging = useListPaging();
  const staffPaging = useListPaging();
  const invitePaging = useListPaging();
  const requestView = paginateItems(requests.data ?? [], requestPaging);
  const staffView = paginateItems(staff.data ?? [], staffPaging);
  const inviteView = paginateItems(invites.data ?? [], invitePaging);

  async function mutate(key: string, operation: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await operation();
      toast.success(success);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["academy", academyId, "join-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["academy", academyId, "staff"] }),
        queryClient.invalidateQueries({ queryKey: ["academy", academyId, "invites"] }),
        queryClient.invalidateQueries({ queryKey: ["academy", academyId, "unlinked-teachers"] }),
      ]);
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return <div className="grid gap-6">
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="text-lg font-semibold">가입 신청 <span className="text-primary">{requests.data?.filter((request) => request.status === "pending").length ?? 0}</span></h2>
      <p className="mt-1 text-sm text-muted-foreground">이름과 휴대폰은 신청자가 입력했습니다. 확인 후 역할을 지정하세요.</p>
      {requests.isError ? <p role="alert" className="mt-3 text-destructive">{toUserMessage(requests.error)}</p> : null}
      {requests.data?.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">가입 신청이 없습니다.</p> : null}
      {requests.data?.length ? <Table aria-label="가입 신청 목록"><TableHeader><TableRow><TableHead>이름</TableHead><TableHead>휴대폰</TableHead><TableHead>신청 방법</TableHead><TableHead>상태</TableHead><TableHead>처리</TableHead></TableRow></TableHeader><TableBody>
        {requestView.items.map((request) => <RequestRow key={request.id} request={request} teachers={teachers.data ?? []} busy={busy === request.id} onReview={(approve, role, teacherId) => mutate(request.id, () => reviewJoinRequest({ requestId: request.id, approve, role, teacherId }), approve ? "직원을 승인했습니다." : "가입 신청을 반려했습니다.")} />)}
      </TableBody></Table> : null}
      <ListPagination itemLabel="가입 신청" countUnit="건" view={requestView} onPageChange={requestPaging.goToPage} onPageSizeChange={requestPaging.changePageSize} />
    </section>

    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="text-lg font-semibold">직원</h2>
      {staff.isError ? <p role="alert" className="mt-3 text-destructive">{toUserMessage(staff.error)}</p> : null}
      {staff.data?.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">등록된 직원이 없습니다.</p> : null}
      {staff.data?.length ? <Table aria-label="직원 목록"><TableHeader><TableRow><TableHead>이름</TableHead><TableHead>휴대폰</TableHead><TableHead>역할</TableHead><TableHead>상태</TableHead><TableHead>관리</TableHead></TableRow></TableHeader><TableBody>
        {staffView.items.map((member) => <StaffRow key={member.member_id} member={member} teachers={teachers.data ?? []} busy={busy === member.member_id} onRoleChange={(role, teacherId) => mutate(member.member_id, () => setStaffRole(member.member_id, role, teacherId), "역할을 변경했습니다.")} onActiveChange={(active) => mutate(member.member_id, () => setStaffActive(member.member_id, active), active ? "직원을 다시 활성화했습니다." : "직원 접근을 중지했습니다.")} />)}
      </TableBody></Table> : null}
      <ListPagination itemLabel="직원" countUnit="명" view={staffView} onPageChange={staffPaging.goToPage} onPageSizeChange={staffPaging.changePageSize} />
    </section>

    <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="text-lg font-semibold">직원 초대와 학원 코드</h2>
      <p className="text-sm text-muted-foreground">초대는 7일 동안 1회 사용할 수 있습니다. 학원 코드는 다시 발급하면 이전 코드가 무효화됩니다.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy !== null} onClick={() => mutate("invite", async () => {
          const [created] = await createInvite(academyId);
          setNewInvite(new URL(`/join#token=${created.invite_token}`, window.location.origin).toString());
        }, "초대 링크를 만들었습니다.")}>초대 링크 만들기</Button>
        <ConfirmAction label="학원 코드 재발급" confirmLabel="재발급 확인" title="학원 코드를 다시 발급할까요?" description="기존 코드는 즉시 무효화됩니다. 새 코드는 발급 직후 한 번만 표시됩니다." disabled={busy !== null} onConfirm={() => mutate("code", async () => setNewCode(await rotateJoinCode(academyId)), "학원 코드를 새로 발급했습니다.")} />
      </div>
      {newInvite ? <div className="flex flex-wrap items-center gap-2"><p className="break-all text-sm">새 초대 링크: {newInvite}</p><Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(newInvite).then(() => toast.success("링크를 복사했습니다.")).catch(() => toast.error("복사하지 못했습니다."))}>링크 복사</Button></div> : null}
      {newCode ? <div className="flex flex-wrap items-center gap-2"><p className="break-all text-sm">새 학원 코드: {newCode}</p><Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(newCode).then(() => toast.success("코드를 복사했습니다.")).catch(() => toast.error("복사하지 못했습니다."))}>코드 복사</Button></div> : null}
      {invites.isError ? <p role="alert" className="text-destructive">{toUserMessage(invites.error)}</p> : null}
      {inviteView.items.map((invite) =>
        <div key={invite.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
          <span>{new Date(invite.created_at).toLocaleDateString("ko-KR")} 발급 · {inviteStatusLabel(invite)}</span>
          {!invite.consumed_at && !invite.revoked_at && new Date(invite.expires_at) > new Date() ? <ConfirmAction label="초대 취소" confirmLabel="취소 확인" title="초대를 취소할까요?" description="이 초대 링크는 즉시 사용할 수 없게 됩니다." disabled={busy !== null} onConfirm={() => mutate(invite.id, () => revokeInvite(academyId, invite.id), "초대를 취소했습니다.")} /> : null}
        </div>)}
      <ListPagination itemLabel="초대" countUnit="건" view={inviteView} onPageChange={invitePaging.goToPage} onPageSizeChange={invitePaging.changePageSize} />
    </section>
  </div>;
}

function RoleField({ value, onChange }: { value: StaffRole; onChange: (role: StaffRole) => void }) {
  return <Select value={value} onValueChange={(role) => onChange(role as StaffRole)}>
    <SelectTrigger aria-label="직원 역할" className="w-28"><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="desk">데스크</SelectItem><SelectItem value="teacher">선생님</SelectItem></SelectContent>
  </Select>;
}

function TeacherField({ value, onChange, teachers }: { value: string; onChange: (id: string) => void; teachers: AvailableTeacherRecord[] }) {
  return <div className="grid gap-1">
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger aria-label="연결할 선생님 기록" className="min-w-36"><SelectValue placeholder="선생님 선택" /></SelectTrigger>
      <SelectContent>{teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>)}</SelectContent>
    </Select>
    {teachers.length === 0 ? <Link className="text-xs text-primary underline" href="/management/teachers">선생님 기록 등록</Link> : null}
  </div>;
}

function RequestRow({ request, teachers, busy, onReview }: {
  request: OwnerJoinRequest; teachers: AvailableTeacherRecord[]; busy: boolean;
  onReview: (approve: boolean, role?: StaffRole, teacherId?: string) => void;
}) {
  const [role, setRole] = useState<StaffRole>("desk");
  const [teacherId, setTeacherId] = useState("");
  return <TableRow>
    <TableCell label="이름">{request.applicant_name}</TableCell>
    <TableCell label="휴대폰">{request.applicant_phone}</TableCell>
    <TableCell label="신청 방법">{request.source === "invite" ? "초대 링크" : "학원 코드"}</TableCell>
    <TableCell label="상태">{requestStatusLabel(request.status)}</TableCell>
    <TableCell label="처리">{request.status === "pending" ? <div className="flex flex-wrap items-center gap-2">
      <RoleField value={role} onChange={setRole} />
      {role === "teacher" ? <TeacherField value={teacherId} onChange={setTeacherId} teachers={teachers.filter((teacher) => !teacher.member_id)} /> : null}
      <Button type="button" size="sm" disabled={busy || (role === "teacher" && !teacherId)} aria-label={`${request.applicant_name} 승인`} onClick={() => onReview(true, role, role === "teacher" ? teacherId : undefined)}>승인</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} aria-label={`${request.applicant_name} 반려`} onClick={() => onReview(false)}>반려</Button>
    </div> : "처리 완료"}</TableCell>
  </TableRow>;
}

function StaffRow({ member, teachers, busy, onRoleChange, onActiveChange }: {
  member: StaffMember; teachers: AvailableTeacherRecord[]; busy: boolean;
  onRoleChange: (role: StaffRole, teacherId?: string) => void;
  onActiveChange: (active: boolean) => void;
}) {
  const [role, setRole] = useState<StaffRole>(member.role);
  const [teacherId, setTeacherId] = useState(member.teacher_id ?? "");
  return <TableRow>
    <TableCell label="이름">{member.display_name}</TableCell>
    <TableCell label="휴대폰">{member.phone ?? "없음"}</TableCell>
    <TableCell label="역할">{member.role === "desk" ? "데스크" : "선생님"}</TableCell>
    <TableCell label="상태">{member.status === "active" ? "활성" : "비활성"}</TableCell>
    <TableCell label="관리"><div className="flex flex-wrap items-center gap-2">
      {member.status === "active" ? <>
        <RoleField value={role} onChange={setRole} />
        {role === "teacher" ? <TeacherField value={teacherId} onChange={setTeacherId} teachers={teachers.filter((teacher) => !teacher.member_id || teacher.member_id === member.member_id)} /> : null}
        <Button type="button" size="sm" variant="outline" disabled={busy || (role === member.role && teacherId === (member.teacher_id ?? "")) || (role === "teacher" && !teacherId)} onClick={() => onRoleChange(role, role === "teacher" ? teacherId : undefined)}>역할 저장</Button>
      </> : null}
      {member.status === "active" ? <ConfirmAction label="접근 중지" confirmLabel="중지 확인" title={`${member.display_name} 직원의 접근을 중지할까요?`} description="이 학원의 데이터에 접근할 수 없게 됩니다. 원장이 나중에 재활성화할 수 있습니다." disabled={busy} onConfirm={() => onActiveChange(false)} /> : <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onActiveChange(true)}>재활성화</Button>}
    </div></TableCell>
  </TableRow>;
}

function ConfirmAction({ label, confirmLabel, title, description, disabled, onConfirm }: {
  label: string;
  confirmLabel: string;
  title: string;
  description: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return <AlertDialog>
    <AlertDialogTrigger asChild><Button type="button" variant="outline" size="sm" disabled={disabled}>{label}</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>돌아가기</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function requestStatusLabel(status: OwnerJoinRequest["status"]) {
  const labels = { pending: "대기", approved: "승인", rejected: "반려", withdrawn: "철회" };
  return labels[status];
}

function inviteStatusLabel(invite: { revoked_at: string | null; consumed_at: string | null; expires_at: string }) {
  if (invite.revoked_at) return "취소";
  if (invite.consumed_at) return "사용";
  if (new Date(invite.expires_at) <= new Date()) return "만료";
  return `${new Date(invite.expires_at).toLocaleDateString("ko-KR")} 만료 예정`;
}
