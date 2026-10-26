import type {
  AbsenceResolutionKind,
  DailyAcademyAttendanceRow,
  LessonEventOrigin,
} from "@/domain/academy-lesson-attendance";

export type CalendarEvent = {
  id: string;
  instrumentId?: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  subtitle: string;
  status: "present" | "absent" | "passed" | "cancelled" | "pending" | "scheduled";
  origin?: LessonEventOrigin;
  originLabel?: string;
  /** 달력 칸에 쓰는 `오후 2시` 같은 시작 시간. 있으면 `detailLabel`과 함께 상세 형태로 그린다. */
  timeLabel?: string;
  /** 달력 칸에 쓰는 `홍길동 (첼로) - OOO 선생님` 같은 한 줄 설명. */
  detailLabel?: string;
  /** `1/4` 같은 현재/총 회차 표시. */
  sessionLabel?: string;
  /** 보강 시간을 입력하지 않은 학원 레슨 일정이라 시간을 보여 주지 않는다. */
  timeUnspecified?: boolean;
  /** 달력에서 다른 날짜로 끌어 옮길 수 있는 출결 전 일정 */
  movable?: boolean;
};

/** 결석 사유서 입력 상태. 입력 순서는 ① 사유 선택 ② 보강 날짜·시간 ③ 사유 메모다. */
export type AbsenceResolutionDraft = {
  /** 결석한 원본 일정 */
  row: DailyAcademyAttendanceRow;
  resolution: AbsenceResolutionKind | "";
  targetDate: string;
  /** 보강 시작 시간(HH:mm). 비어 있으면 시간을 입력하지 않은 것이다. */
  startTime: string;
  reason: string;
};

/** 출석확인에서 확인을 눌러 한꺼번에 저장할 원생별 선택 */
export type AttendanceSelection = {
  row: DailyAcademyAttendanceRow;
  status: "present" | "absent";
};

export type DeleteLessonDraft = {
  row: DailyAcademyAttendanceRow;
  reason: string;
};

export type MoveLessonDraft = {
  row: DailyAcademyAttendanceRow;
  targetDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

export type LessonRouteKind = "academy" | "private";

export type LessonTab = LessonRouteKind;

export type LessonView = "calendar" | "table";

export type LessonMemoTargetOption = {
  id: string;
  name: string;
};

export type LessonMemoTargetOptions = {
  students: LessonMemoTargetOption[];
  teachers: LessonMemoTargetOption[];
};

export type LessonMemoDraft = {
  studentId: string;
  teacherId: string;
  content: string;
};
