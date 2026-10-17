import { useId, useReducer, useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import type { UpdateStudentEnrollmentsInput } from "@/domain/student-enrollment-edit";
import type { StudentListRow } from "@/domain/student-list";
import type { TeacherListRow } from "@/domain/teacher-list";

import {
  createBasicFormValues,
  getContactPhoneError,
  hasBasicInfoChanged,
  toBasicInfoInput,
  type StudentBasicFormValues,
} from "./student-basic-info";
import { StudentBasicInfoFields } from "./student-basic-info-fields";
import { toStudentSaveFailureMessage } from "./student-edit-save";
import {
  buildEnrollmentChanges,
  createEnrollmentEdits,
  enrollmentEditsReducer,
  getBlockedSectionLabels,
} from "./student-enrollment-edit-state";
import { StudentInstrumentEditPanel } from "./student-instrument-edit-panel";


/**
 * 원생 수정 폼. 기본 정보·연락처는 한 번만, 수강 정보는 악기마다 섹션으로 고치고 악기를 추가하거나 종료할 수 있다.
 * 저장은 바뀐 것만 담은 요청 하나로 `onSubmit`에 넘기고, 바뀐 것이 없으면 저장하지 않고 폼을 닫는다.
 * 저장이 실패하면 서버가 아무것도 저장하지 않으므로 입력값을 그대로 둔 채 알린다.
 */
export function StudentEditForm({
  student,
  teachers,
  isSaving,
  onCancel,
  onSubmit,
}: {
  student: StudentListRow;
  teachers: TeacherListRow[];
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (input: UpdateStudentEnrollmentsInput) => Promise<void>;
}) {
  const blockedNoticeId = useId();
  // 변경 여부는 폼을 연 때의 입력값과 비교한다. 저장에 실패해 다시 저장해도 같은 기준이다.
  const [initialValues] = useState(() => createBasicFormValues(student));
  const [initialEdits] = useState(() => createEnrollmentEdits(student));
  const [values, setValues] = useState(initialValues);
  const [edits, dispatch] = useReducer(enrollmentEditsReducer, initialEdits);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasExistingContact = Boolean(student.contacts?.[0]);
  const referenceMonth = toReferenceMonth(values.registeredOn);
  const phoneError = getContactPhoneError(values.contactPhone, hasExistingContact);
  const blockedLabels = getBlockedSectionLabels(edits, teachers, referenceMonth);
  const canSubmit =
    Boolean(values.name.trim()) &&
    Boolean(values.registeredOn) &&
    !phoneError &&
    blockedLabels.length === 0;
  // 섹션이 하나뿐이면 오류가 그 섹션 안에 바로 보이므로, 여러 섹션일 때만 어느 섹션이 막는지 따로 알린다.
  const showsBlockedNotice = edits.instruments.length + edits.added.length > 1 && blockedLabels.length > 0;

  function updateValues(patch: Partial<StudentBasicFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function buildSubmitInput(): UpdateStudentEnrollmentsInput | null {
    const changes = buildEnrollmentChanges({
      initial: initialEdits,
      edits,
      teachers,
      referenceMonth,
      initialReferenceMonth: toReferenceMonth(initialValues.registeredOn),
    });
    const hasNameChange = values.name.trim() !== initialValues.name.trim();
    const hasBasicInfoChange = hasBasicInfoChanged(values, initialValues);

    if (!hasNameChange && !hasBasicInfoChange && changes.length === 0) {
      return null;
    }

    return {
      academyId: student.academyId,
      studentId: student.studentId,
      name: values.name.trim(),
      ...(hasBasicInfoChange ? { basicInfo: toBasicInfoInput(values) } : {}),
      changes,
    };
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit || isSaving) {
          return;
        }

        const input = buildSubmitInput();

        if (!input) {
          onCancel();
          return;
        }

        setSaveError(null);
        void onSubmit(input).catch((error: unknown) =>
          setSaveError(toStudentSaveFailureMessage(error)),
        );
      }}
    >
      <StudentBasicInfoFields values={values} phoneError={phoneError} onChange={updateValues} />

      <StudentInstrumentEditPanel
        edits={edits}
        teachers={teachers}
        referenceMonth={referenceMonth}
        dispatch={dispatch}
      />

      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}
      {showsBlockedNotice ? (
        <p id={blockedNoticeId} className="text-sm text-destructive">
          저장하려면 {blockedLabels.join(", ")} 수업 정보를 확인해 주세요.
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || isSaving}
          aria-describedby={showsBlockedNotice ? blockedNoticeId : undefined}
        >
          수정완료
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 지인 소개 할인 달의 기본값으로 쓰는 등록 달 `YYYY-MM`. */
function toReferenceMonth(registeredOn: string) {
  return registeredOn.slice(0, 7);
}
