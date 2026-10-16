import { compareKoreanNames } from "@/domain/common-list";
import type { TeacherListRow } from "@/domain/teacher-list";

export const instrumentOptions = [
  { id: "piano", name: "피아노" },
  { id: "violin", name: "바이올린" },
  { id: "cello", name: "첼로" },
  { id: "flute", name: "플루트" },
];

export const weekdayOptions = [
  { value: "monday", label: "월" },
  { value: "tuesday", label: "화" },
  { value: "wednesday", label: "수" },
  { value: "thursday", label: "목" },
  { value: "friday", label: "금" },
  { value: "saturday", label: "토" },
  { value: "sunday", label: "일" },
];

/** 새로 고를 수 있는 수강 요일(월~토). 일요일은 저장된 이전 데이터에만 남아 있다. */
export const selectableWeekdayOptions = weekdayOptions.filter((weekday) => weekday.value !== "sunday");

export const contactRelationshipOptions = ["모", "부", "본인", "보호자"];

export function getDefaultTeacherId(instrumentName: string, teachers: TeacherListRow[]) {
  const candidates = getTeacherCandidates(instrumentName, teachers);

  return candidates.length === 1 ? candidates[0].teacherId : "";
}

export function getTeacherCandidates(instrumentName: string, teachers: TeacherListRow[]) {
  return teachers
    .filter((teacher) => teacher.part === instrumentName)
    .sort((left, right) => compareKoreanNames(left.name, right.name));
}

export function toWeekdayValue(label: string) {
  return weekdayOptions.find((weekday) => weekday.label === label)?.value ?? label;
}

export function toWeekdayLabel(value: string) {
  return weekdayOptions.find((weekday) => weekday.value === value)?.label ?? value;
}
