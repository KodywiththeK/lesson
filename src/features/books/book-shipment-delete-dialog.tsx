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
import type { BookShipmentRow } from "@/domain/book-sale";

import { formatQuantity } from "./book-format";

/** 출고 삭제 확인. 삭제하면 재고가 돌아온다고 알리고, 끝나기 전에는 닫히지 않으며 처리 중에는 중복 클릭을 막는다. */
export function BookShipmentDeleteDialog({
  shipment,
  isDeleting,
  onClose,
  onConfirm,
}: {
  shipment: BookShipmentRow | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (shipment: BookShipmentRow) => void;
}) {
  return (
    <AlertDialog open={shipment !== null} onOpenChange={(open) => (open || isDeleting ? undefined : onClose())}>
      {shipment ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>출고 내역을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {shipment.studentName}의 {shipment.bookTitle} {formatQuantity(shipment.quantity)} 출고 내역을 삭제합니다.
              삭제하면 재고가 {formatQuantity(shipment.quantity)} 되돌아옵니다.
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
                onConfirm(shipment);
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
