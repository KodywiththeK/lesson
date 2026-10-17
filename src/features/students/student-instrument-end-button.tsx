import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LAST_INSTRUMENT_END_MESSAGE } from "@/domain/student-enrollment-edit";

/**
 * 악기 하나의 [수강 종료]. 확인하면 종료 예정으로만 표시하고, 실제 종료는 수정완료를 눌러 저장할 때 일어난다.
 * 마지막 활성 악기는 종료할 수 없어 버튼을 막고 이유를 보여 준다.
 */
export function StudentInstrumentEndButton({
  instrumentName,
  labelPrefix,
  canEnd,
  onConfirm,
}: {
  instrumentName: string;
  /** 접근 가능한 이름 접두사. 악기가 여러 개일 때만 넘긴다(예: "피아노 "). */
  labelPrefix: string;
  canEnd: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canEnd ? null : (
        <span className="text-xs text-muted-foreground">{LAST_INSTRUMENT_END_MESSAGE}</span>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${labelPrefix}수강 종료`}
            disabled={!canEnd}
          >
            수강 종료
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{instrumentName} 수강을 종료할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              종료 예정으로 표시하고, 수정완료를 눌러 저장할 때 실제로 종료합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
            <li>
              오늘 이후 출석 기록이 없는 정기 일정이 취소되고, 이동·보강·개인레슨 예정 일정은 남습니다.
            </li>
            <li>이미 만들어진 월 수강료 기록은 바뀌지 않습니다.</li>
            <li>남은 일정과 수강료는 필요하면 레슨표·수입 관리에서 확인해 주세요.</li>
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>종료 예정으로 표시</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
