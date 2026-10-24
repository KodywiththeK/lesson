import { useState, type ReactNode } from "react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { getFinanceToday } from "@/domain/finance-date";
import {
  calculateBirthYearFromAge,
  getSuggestedStudentGrade,
  getSuggestedStudentOccupation,
  getStudentDemographicValidationError,
} from "@/domain/student-grade";
import {
  hasSameStudentName,
  type StudentInstrumentDiscountSelection,
} from "@/domain/student-registration";
import type { TeacherListRow } from "@/domain/teacher-list";
import type { DemoStudentRegistrationInput } from "@/lib/demo/academy-demo-state";

import { contactRelationshipOptions, instrumentOptions } from "./student-form-options";
import { StudentDemographicFields } from "./student-demographic-fields";
import {
  buildRegistrationInstrument,
  createRegistrationInstrumentDraft,
  isRegistrationInstrumentReady,
  type StudentRegistrationInstrumentDraft,
} from "./student-registration-instrument";
import { StudentRegistrationInstrumentCard } from "./student-registration-instrument-card";
import { StudentSecondaryContactFields } from "./student-secondary-contact-fields";
import { getSecondaryContactErrors } from "./student-secondary-contact";

/**
 * 등록 폼이 내보내는 입력. 데모 등록 입력에 악기별 할인 선택(종류·소개 달)을 더한 상위 타입이라
 * 데모 상태는 새 필드를 무시해도 그대로 받을 수 있다.
 */
export type StudentRegistrationSubmission = Omit<DemoStudentRegistrationInput, "instruments"> & {
  instruments: Array<
    DemoStudentRegistrationInput["instruments"][number] & StudentInstrumentDiscountSelection
  >;
};

/** 상담 등 다른 화면에서 등록 폼을 미리 채울 때 쓰는 초기값. */
export type StudentRegistrationInitialValues = {
  name?: string;
  age?: number;
  birthYear?: number;
  school?: string;
  phone?: string;
  instrumentNames?: string[];
};

type StudentRegistrationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 있으면 다이얼로그를 여는 버튼으로 쓴다. 없으면 `open`으로만 제어한다. */
  trigger?: ReactNode;
  teachers: TeacherListRow[];
  initialValues?: StudentRegistrationInitialValues;
  /** 같은 이름의 재원 원생이 있으면 구분 안내를 보이기 위한 기존 원생 이름. 없으면 안내하지 않는다. */
  existingStudentNames?: string[];
  onSubmit: (input: StudentRegistrationSubmission) => void | Promise<void>;
};

export function StudentRegistrationDialog({
  open,
  onOpenChange,
  trigger,
  teachers,
  initialValues,
  existingStudentNames,
  onSubmit,
}: StudentRegistrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>원생 등록</DialogTitle>
          <DialogDescription>
            원생의 수강 악기와 레슨 기준을 함께 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <StudentRegistrationForm
          teachers={teachers}
          initialValues={initialValues}
          existingStudentNames={existingStudentNames}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function StudentRegistrationForm({
  teachers,
  initialValues,
  existingStudentNames = [],
  onSubmit,
}: {
  teachers: TeacherListRow[];
  initialValues?: StudentRegistrationInitialValues;
  existingStudentNames?: string[];
  onSubmit: (input: StudentRegistrationSubmission) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [registeredAt, setRegisteredAt] = useState(getFinanceToday());
  const [age, setAge] = useState(
    initialValues?.age === undefined ? "" : String(initialValues.age),
  );
  const [birthYear, setBirthYear] = useState(() => {
    if (initialValues?.birthYear !== undefined) return String(initialValues.birthYear);
    if (initialValues?.age === undefined) return "";
    return String(calculateBirthYearFromAge(
      initialValues.age,
      Number(getFinanceToday().slice(0, 4)),
    ) ?? "");
  });
  const [grade, setGrade] = useState(() => getSuggestedStudentGrade(initialValues?.age ?? NaN));
  const [school, setSchool] = useState(initialValues?.school ?? "");
  const [occupation, setOccupation] = useState(getSuggestedStudentOccupation(initialValues?.age === undefined ? "" : String(initialValues.age)));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactRelationship, setContactRelationship] = useState("모");
  const [contactPhone, setContactPhone] = useState(initialValues?.phone ?? "");
  const [secondaryRelationship, setSecondaryRelationship] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [initialInstruments] = useState(() =>
    pickInitialInstruments(initialValues?.instrumentNames),
  );
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState(() =>
    initialInstruments.map((instrument) => instrument.id),
  );
  const [instrumentDrafts, setInstrumentDrafts] = useState<
    Record<string, StudentRegistrationInstrumentDraft>
  >(() =>
    Object.fromEntries(
      initialInstruments.map((instrument) => [
        instrument.id,
        createRegistrationInstrumentDraft(instrument, teachers),
      ]),
    ),
  );

  const referenceMonth = /^\d{4}-\d{2}/.test(registeredAt) ? registeredAt.slice(0, 7) : "";
  const demographicError = getStudentDemographicValidationError({
    ageText: age,
    birthYearText: birthYear,
    currentYear: Number(getFinanceToday().slice(0, 4)),
  });
  const orderedDrafts = selectedInstrumentIds
    .map((instrumentId) => instrumentDrafts[instrumentId])
    .filter(Boolean);
  const canSubmit = Boolean(
    name.trim() &&
      registeredAt &&
      contactPhone.replace(/\D/g, "").length >= 4 &&
      !demographicError &&
      Object.keys(getSecondaryContactErrors(secondaryRelationship, secondaryPhone)).length === 0 &&
      orderedDrafts.length > 0 &&
      orderedDrafts.every((draft) =>
        isRegistrationInstrumentReady(draft, teachers, referenceMonth),
      ),
  );

  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();

        if (!canSubmit || isSubmitting) {
          return;
        }

        setIsSubmitting(true);
        try {
          await onSubmit({
            name: name.trim(),
            registeredAt,
            age: age ? Number(age) : undefined,
            birthYear: birthYear ? Number(birthYear) : undefined,
            grade: grade.trim() || undefined,
            school: school.trim() || undefined,
            occupation: occupation.trim() || undefined,
            contact: {
              relationship: contactRelationship.trim() || "본인",
              phone: contactPhone.trim(),
            },
            ...(secondaryRelationship.trim() && secondaryPhone.trim()
              ? { secondaryContact: { relationship: secondaryRelationship.trim(), phone: secondaryPhone.trim() } }
              : {}),
            instruments: orderedDrafts.map((draft) =>
              buildRegistrationInstrument(draft, teachers, referenceMonth),
            ),
          });
        } catch {
          // 화면 상위 mutation이 사용자용 오류를 표시한다. 입력은 그대로 두고 재시도할 수 있게 한다.
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>원생명</span>
          <Input
            aria-label="원생명"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {hasSameStudentName(name, existingStudentNames) ? (
            <span role="status" className="text-xs text-muted-foreground">
              같은 이름의 원생이 있습니다. 홍길동a, 홍길동b처럼 구분해 주세요.
            </span>
          ) : null}
        </Label>
        <Label className="grid gap-1">
          <span>등록일</span>
          <DateField
            aria-label="등록일"
            value={registeredAt}
            onValueChange={setRegisteredAt}
          />
        </Label>
      </div>

      <StudentDemographicFields
        values={{ age, birthYear, grade, school, occupation }}
        hasManualGradeInitially={false}
        hasManualOccupationInitially={false}
        onChange={(patch) => {
          if (patch.age !== undefined) setAge(patch.age);
          if (patch.birthYear !== undefined) setBirthYear(patch.birthYear);
          if (patch.grade !== undefined) setGrade(patch.grade);
          if (patch.school !== undefined) setSchool(patch.school);
          if (patch.occupation !== undefined) setOccupation(patch.occupation);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Label className="grid gap-1">
          <span>연락처 구분</span>
          <NativeSelect
            aria-label="연락처 구분"
            value={contactRelationship}
            onChange={(event) => setContactRelationship(event.target.value)}
          >
            {contactRelationshipOptions.map((relationship) => (
              <NativeSelectOption key={relationship} value={relationship}>
                {relationship}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>연락처</span>
          <Input
            aria-label="연락처"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="010-0000-0000"
          />
        </Label>
      </div>

      <StudentSecondaryContactFields
        relationship={secondaryRelationship}
        phone={secondaryPhone}
        onChange={(patch) => {
          if (patch.relationship !== undefined) setSecondaryRelationship(patch.relationship);
          if (patch.phone !== undefined) setSecondaryPhone(patch.phone);
        }}
      />

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">
          악기 선택 <span className="text-muted-foreground">(복수 선택 가능)</span>
        </legend>
        <div className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-4">
          {instrumentOptions.map((instrument) => (
            <Label key={instrument.id} className="flex items-center gap-2">
              <Checkbox
                aria-label={`${instrument.name} 선택`}
                checked={selectedInstrumentIds.includes(instrument.id)}
                onCheckedChange={(checked) => {
                  setSelectedInstrumentIds((current) =>
                    checked
                      ? [...new Set([...current, instrument.id])]
                      : current.filter((value) => value !== instrument.id),
                  );
                  setInstrumentDrafts((current) => {
                    if (checked && !current[instrument.id]) {
                      return {
                        ...current,
                        [instrument.id]: createRegistrationInstrumentDraft(
                          instrument,
                          teachers,
                        ),
                      };
                    }

                    return current;
                  });
                }}
              />
              <span>{instrument.name}</span>
            </Label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3">
        {orderedDrafts.map((draft) => (
          <StudentRegistrationInstrumentCard
            key={draft.instrumentId}
            draft={draft}
            teachers={teachers}
            referenceMonth={referenceMonth}
            onChange={(nextDraft) =>
              setInstrumentDrafts((current) => ({
                ...current,
                [draft.instrumentId]: nextDraft,
              }))
            }
          />
        ))}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "등록 중…" : "등록"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 목록에 있는 악기만 고르고, 하나도 없으면 피아노로 시작한다. */
function pickInitialInstruments(instrumentNames: string[] | undefined) {
  const matched = instrumentOptions.filter((instrument) =>
    instrumentNames?.includes(instrument.name),
  );

  return matched.length > 0 ? matched : [instrumentOptions[0]];
}
