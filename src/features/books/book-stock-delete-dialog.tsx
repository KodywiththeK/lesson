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
import type { BookStockRow } from "@/domain/book-stock";

export type PendingReleaseNotice = {
  /** 대기 출고 건수를 확인하는 중. 끝나기 전에는 삭제를 막아 안내를 놓치지 않게 한다. */
  isChecking: boolean;
  /** 확인한 대기 출고 건수. 조회하지 못했으면 null이고 안내를 생략한다. */
  count: number | null;
};

/** 교재 삭제(보관) 확인. 삭제가 끝나기 전에는 닫히지 않고, 처리 중에는 중복 클릭을 막는다. */
export function BookStockDeleteDialog({
  book,
  pendingReleases,
  isDeleting,
  onClose,
  onConfirm,
}: {
  book: BookStockRow | null;
  pendingReleases: PendingReleaseNotice;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (book: BookStockRow) => void;
}) {
  const canConfirm = !isDeleting && !pendingReleases.isChecking;

  return (
    <AlertDialog open={book !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {book ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>교재를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {book.title} 교재를 재고 목록과 출고 선택지에서 삭제합니다. 과거 판매 기록은 그대로 남습니다.
            </AlertDialogDescription>
            <PendingReleaseMessage pendingReleases={pendingReleases} />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm}
              onClick={(event) => {
                // 삭제가 끝나기 전에는 닫지 않는다. 성공하면 호출한 쪽이 대상을 비운다.
                event.preventDefault();
                onConfirm(book);
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

function PendingReleaseMessage({ pendingReleases }: { pendingReleases: PendingReleaseNotice }) {
  if (pendingReleases.isChecking) {
    return <p className="text-sm text-muted-foreground">대기 중인 출고를 확인하고 있습니다.</p>;
  }

  if (!pendingReleases.count) {
    return null;
  }

  return (
    <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
      대기 중인 출고 {pendingReleases.count}건이 있습니다. 삭제해도 대기 건은 계속 결제 처리할 수 있습니다.
    </p>
  );
}
