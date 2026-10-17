import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { TeacherListRow } from "@/domain/teacher-list";

import { getAddedReferenceMonth } from "./student-enrollment-edit-state";
import type { StudentLessonType, StudentRegistrationInstrumentDraft } from "./student-registration-instrument";
import { StudentRegistrationInstrumentCard } from "./student-registration-instrument-card";

/**
 * 수정 화면에서 새로 추가하는 악기 하나. 등록 폼과 같은 악기 카드에 수강 시작일을 더했고,
 * 저장하기 전에는 [추가 취소]로 지울 수 있다.
 */
export function StudentAddedInstrumentSection({
  label,
  draft,
  startedOn,
  lessonTypes,
  canRemove,
  teachers,
  onDraftChange,
  onStartedOnChange,
  onRemove,
}: {
  label: string;
  draft: StudentRegistrationInstrumentDraft;
  startedOn: string;
  lessonTypes: StudentLessonType[];
  canRemove: boolean;
  teachers: TeacherListRow[];
  onDraftChange: (draft: StudentRegistrationInstrumentDraft) => void;
  onStartedOnChange: (startedOn: string) => void;
  onRemove: () => void;
}) {
  return (
    <StudentRegistrationInstrumentCard
      draft={draft}
      label={label}
      lessonTypes={lessonTypes}
      teachers={teachers}
      referenceMonth={getAddedReferenceMonth(startedOn)}
      headerAction={
        <>
          {canRemove ? null : (
            <span className="text-xs text-muted-foreground">
              종료 예정인 악기를 되돌리면 추가를 취소할 수 있습니다.
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${label} 추가 취소`}
            disabled={!canRemove}
            onClick={onRemove}
          >
            추가 취소
          </Button>
        </>
      }
      onChange={onDraftChange}
    >
      <Label className="grid gap-1 sm:max-w-xs">
        <span>수강 시작일</span>
        <DateField
          aria-label={`${label} 수강 시작일`}
          value={startedOn}
          onValueChange={onStartedOnChange}
        />
      </Label>
    </StudentRegistrationInstrumentCard>
  );
}
