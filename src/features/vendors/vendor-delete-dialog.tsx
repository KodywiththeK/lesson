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
import type { VendorListRow } from "@/domain/vendor-list";

/** 거래처 삭제 확인. 과거 발주 내역에는 이름이 남는다고 알리고, 끝나기 전에는 닫히지 않으며 처리 중에는 중복 클릭을 막는다. */
export function VendorDeleteDialog({
  vendor,
  isDeleting,
  onClose,
  onConfirm,
}: {
  vendor: VendorListRow | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (vendor: VendorListRow) => void;
}) {
  return (
    <AlertDialog open={vendor !== null} onOpenChange={(open) => (open || isDeleting ? undefined : onClose())}>
      {vendor ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>거래처를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {vendor.name} 거래처를 삭제합니다. 과거 발주 내역에는 거래처 이름이 남습니다. 삭제한 거래처는 되돌릴 수 없고,
              이후 발주에서 선택할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                // 삭제가 끝나기 전에는 닫지 않는다. 성공하면 호출한 쪽이 대상을 비운다.
                event.preventDefault();
                onConfirm(vendor);
              }}
            >
              {isDeleting ? "처리 중" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
