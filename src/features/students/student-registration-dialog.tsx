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
  hasSameStudentName,
  type StudentInstrumentDiscountSelection,
} from "@/domain/student-registration";
import type { TeacherListRow } from "@/domain/teacher-list";
import type { DemoStudentRegistrationInput } from "@/lib/demo/academy-demo-state";

import { contactRelationshipOptions, instrumentOptions } from "./student-form-options";
import {
  buildRegistrationInstrument,
  createRegistrationInstrumentDraft,
  isRegistrationInstrumentReady,
  type StudentRegistrationInstrumentDraft,
} from "./student-registration-instrument";
import { StudentRegistrationInstrumentCard } from "./student-registration-instrument-card";

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
  onSubmit: (input: StudentRegistrationSubmission) => void;
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
  onSubmit: (input: StudentRegistrationSubmission) => void;
}) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [registeredAt, setRegisteredAt] = useState(getFinanceToday());
  const [age, setAge] = useState(
    initialValues?.age === undefined ? "" : String(initialValues.age),
  );
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState(initialValues?.school ?? "");
  const [occupation, setOccupation] = useState("");
  const [contactRelationship, setContactRelationship] = useState("모");
  const [contactPhone, setContactPhone] = useState(initialValues?.phone ?? "");
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
  const orderedDrafts = selectedInstrumentIds
    .map((instrumentId) => instrumentDrafts[instrumentId])
    .filter(Boolean);
  const canSubmit = Boolean(
    name.trim() &&
      registeredAt &&
      contactPhone.replace(/\D/g, "").length >= 4 &&
      orderedDrafts.length > 0 &&
      orderedDrafts.every((draft) =>
        isRegistrationInstrumentReady(draft, teachers, referenceMonth),
      ),
  );

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({
          name: name.trim(),
          registeredAt,
          age: age ? Number(age) : undefined,
          grade: grade.trim() || undefined,
          school: school.trim() || undefined,
          occupation: occupation.trim() || undefined,
          contact: {
            relationship: contactRelationship.trim() || "본인",
            phone: contactPhone.trim(),
          },
          instruments: orderedDrafts.map((draft) =>
            buildRegistrationInstrument(draft, teachers, referenceMonth),
          ),
        });
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

      <div className="grid gap-3 sm:grid-cols-4">
        <Label className="grid gap-1">
          <span>나이</span>
          <Input
            aria-label="나이"
            min={0}
            type="number"
            value={age}
            onChange={(event) => setAge(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>학년</span>
          <Input
            aria-label="학년"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            placeholder="초등 1학년"
          />
        </Label>
        <Label className="grid gap-1">
          <span>학교</span>
          <Input
            aria-label="학교"
            value={school}
            onChange={(event) => setSchool(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>직업</span>
          <Input
            aria-label="직업"
            value={occupation}
            onChange={(event) => setOccupation(event.target.value)}
          />
        </Label>
      </div>

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
        <Button type="submit" disabled={!canSubmit}>
          등록
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
