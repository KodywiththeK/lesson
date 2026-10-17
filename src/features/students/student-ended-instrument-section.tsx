import { Button } from "@/components/ui/button";

/** 종료 예정으로 표시한 악기. 입력칸은 숨기고 흐리게 보이며, 되돌리면 입력했던 내용 그대로 돌아온다. */
export function StudentEndedInstrumentSection({
  label,
  onRestore,
}: {
  label: string;
  onRestore: () => void;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/40 p-4">
      <div className="grid gap-1 opacity-60">
        <h3 className="text-base font-semibold">{label} 수강 종료 예정</h3>
        <p className="text-sm text-muted-foreground">수정완료를 누르면 이 악기의 수강이 종료됩니다.</p>
      </div>
      <Button type="button" variant="outline" size="sm" aria-label={`${label} 되돌리기`} onClick={onRestore}>
        되돌리기
      </Button>
    </section>
  );
}
