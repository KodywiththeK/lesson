import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ConsultationListRow } from "@/domain/consultation-list";

/** 상담 기록 삭제 확인. 삭제가 끝나기 전에는 닫히지 않고, 처리 중에는 중복 클릭을 막는다. */
export function ConsultationDeleteDialog({
  consultation,
  isDeleting,
  onClose,
  onConfirm,
}: {
  consultation: ConsultationListRow | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (consultation: ConsultationListRow) => void;
}) {
  return (
    <AlertDialog open={consultation !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {consultation ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>상담 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {consultation.name} 상담 기록을 삭제합니다. 삭제한 기록은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                // 삭제가 끝나기 전에는 닫지 않는다. 성공하면 호출한 쪽이 대상을 비운다.
                event.preventDefault();
                onConfirm(consultation);
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
