import { Plus } from "lucide-react";
import { useState, type Dispatch } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getFinanceToday } from "@/domain/finance-date";
import type { TeacherListRow } from "@/domain/teacher-list";

import { StudentAddedInstrumentSection } from "./student-added-instrument-section";
import { StudentEndedInstrumentSection } from "./student-ended-instrument-section";
import {
  canEndInstrument,
  canRemoveAdded,
  getAddableInstruments,
  getAddedInstrumentLabels,
  getAvailableLessonTypes,
  getLessonTypeChoices,
  type EnrollmentEditAction,
  type EnrollmentEdits,
} from "./student-enrollment-edit-state";
import { getInstrumentSectionLabels } from "./student-instrument-edit";
import { StudentInstrumentEditSection } from "./student-instrument-edit-section";

/**
 * 원생 수정 폼의 수강 영역. 기존 악기 섹션(또는 종료 예정 표시), 새로 추가한 악기 섹션, [악기 추가]를 보여 준다.
 * 섹션이 둘 이상이면 제목과 접근 가능한 이름에 악기 이름을 붙여 구분한다.
 */
export function StudentInstrumentEditPanel({
  edits,
  teachers,
  referenceMonth,
  dispatch,
}: {
  edits: EnrollmentEdits;
  teachers: TeacherListRow[];
  referenceMonth: string;
  dispatch: Dispatch<EnrollmentEditAction>;
}) {
  const hasMultipleSections = edits.instruments.length + edits.added.length > 1;
  const sectionLabels = getInstrumentSectionLabels(edits.instruments);
  const addedLabels = getAddedInstrumentLabels(edits.added);

  return (
    <>
      {edits.instruments.length === 0 && edits.added.length === 0 ? (
        <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
          등록된 수업 정보가 없습니다.
        </p>
      ) : null}

      {edits.instruments.map((instrument, index) => {
        const { studentInstrumentId } = instrument;

        return edits.endedIds.includes(studentInstrumentId) ? (
          <StudentEndedInstrumentSection
            key={studentInstrumentId}
            label={sectionLabels[index]}
            onRestore={() => dispatch({ type: "restoreInstrument", studentInstrumentId })}
          />
        ) : (
          <StudentInstrumentEditSection
            key={studentInstrumentId}
            instrument={instrument}
            label={hasMultipleSections ? sectionLabels[index] : undefined}
            teachers={teachers}
            draft={edits.drafts[studentInstrumentId]}
            lessonTypeChoices={getLessonTypeChoices(edits, studentInstrumentId)}
            referenceMonth={referenceMonth}
            canEnd={canEndInstrument(edits, studentInstrumentId)}
            onChange={(draft) => dispatch({ type: "updateInstrument", studentInstrumentId, draft })}
            onEnd={() => dispatch({ type: "endInstrument", studentInstrumentId })}
          />
        );
      })}

      {edits.added.map((added, index) => (
        <StudentAddedInstrumentSection
          key={added.key}
          label={addedLabels[index]}
          draft={added.draft}
          startedOn={added.startedOn}
          lessonTypes={getAvailableLessonTypes(
            edits,
            { id: added.draft.instrumentId, name: added.draft.instrumentName },
            added.key,
          )}
          canRemove={canRemoveAdded(edits, added.key)}
          teachers={teachers}
          onDraftChange={(draft) =>
            dispatch({ type: "updateAdded", key: added.key, patch: { draft } })
          }
          onStartedOnChange={(startedOn) =>
            dispatch({ type: "updateAdded", key: added.key, patch: { startedOn } })
          }
          onRemove={() => dispatch({ type: "removeAdded", key: added.key })}
        />
      ))}

      <AddInstrumentControl edits={edits} teachers={teachers} dispatch={dispatch} />
    </>
  );
}

function AddInstrumentControl({
  edits,
  teachers,
  dispatch,
}: {
  edits: EnrollmentEdits;
  teachers: TeacherListRow[];
  dispatch: Dispatch<EnrollmentEditAction>;
}) {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("");
  const addableInstruments = getAddableInstruments(edits);
  const selectedInstrument = addableInstruments.find(
    (instrument) => instrument.id === selectedInstrumentId,
  );

  if (addableInstruments.length === 0) {
    return <p className="text-sm text-muted-foreground">추가할 수 있는 악기가 없습니다.</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Label className="grid gap-1">
        <span>추가할 악기</span>
        <NativeSelect
          aria-label="추가할 악기"
          value={selectedInstrument?.id ?? ""}
          onChange={(event) => setSelectedInstrumentId(event.target.value)}
        >
          <NativeSelectOption value="">악기를 선택해 주세요</NativeSelectOption>
          {addableInstruments.map((instrument) => (
            <NativeSelectOption key={instrument.id} value={instrument.id}>
              {instrument.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <Button
        type="button"
        variant="outline"
        disabled={!selectedInstrument}
        onClick={() => {
          if (!selectedInstrument) {
            return;
          }

          dispatch({
            type: "addInstrument",
            instrument: selectedInstrument,
            teachers,
            startedOn: getFinanceToday(),
          });
          setSelectedInstrumentId("");
        }}
      >
        <Plus aria-hidden="true" />
        악기 추가
      </Button>
    </div>
  );
}
