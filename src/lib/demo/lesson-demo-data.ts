import type { DailyAcademyAttendanceSheet } from "@/domain/academy-lesson-attendance";
import type { PrivateLesson } from "@/domain/private-lesson";
import type { PrivateLessonRegistrationOptions } from "@/lib/api/private-lessons";

export type LessonWorkspaceDemoData = {
  academySheets: DailyAcademyAttendanceSheet[];
  privateLessons: PrivateLesson[];
  registrationOptions: PrivateLessonRegistrationOptions;
  academyMemo: string;
  privateMemo: string;
};

export const demoLessonWorkspaceData: LessonWorkspaceDemoData = {
  academySheets: [
    {
      academyId: "academy-demo",
      date: "2026-08-21",
      rows: [
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-21",
          startTime: "15:00",
          endTime: "15:50",
          status: "present",
          markedAt: "2026-08-21T15:55:00+09:00",
        },
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-2",
          studentId: "student-2",
          studentName: "이서윤",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-21",
          startTime: "16:00",
          endTime: "16:50",
          status: "pending",
        },
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-3",
          studentId: "student-3",
          studentName: "박지호",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-21",
          startTime: "17:00",
          endTime: "17:50",
          status: "absent",
          absenceReason: "연락 대기",
          markedAt: "2026-08-21T17:10:00+09:00",
        },
      ],
      absenceQueue: [
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-3",
          studentId: "student-3",
          studentName: "박지호",
          instrumentId: "piano",
          instrumentName: "피아노",
          originalDate: "2026-08-21",
          reason: "연락 대기",
          markedAt: "2026-08-21T17:10:00+09:00",
        },
      ],
      summary: {
        total: 3,
        present: 1,
        absent: 1,
        pending: 1,
      },
    },
    {
      academyId: "academy-demo",
      date: "2026-08-22",
      rows: [
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-4",
          studentId: "student-5",
          studentName: "정하린",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-22",
          startTime: "11:00",
          endTime: "11:50",
          status: "pending",
        },
      ],
      absenceQueue: [],
      summary: {
        total: 1,
        present: 0,
        absent: 0,
        pending: 1,
      },
    },
  ],
  privateLessons: [
    {
      id: "private-lesson-1",
      academyId: "academy-demo",
      studentId: "student-4",
      studentName: "한서아",
      instrumentId: "violin",
      instrumentName: "바이올린",
      teacherId: "teacher-2",
      teacherName: "오유진",
      startAt: "2026-08-21T18:00:00+09:00",
      endAt: "2026-08-21T18:40:00+09:00",
      status: "scheduled",
    },
    {
      id: "private-lesson-2",
      academyId: "academy-demo",
      studentId: "student-6",
      studentName: "최도윤",
      instrumentId: "cello",
      instrumentName: "첼로",
      teacherId: "teacher-3",
      teacherName: "문서준",
      startAt: "2026-08-22T10:30:00+09:00",
      endAt: "2026-08-22T11:30:00+09:00",
      status: "scheduled",
    },
  ],
  registrationOptions: {
    students: [
      {
        studentId: "student-4",
        studentName: "한서아",
        instruments: [
          {
            studentInstrumentId: "student-instrument-4",
            instrumentId: "violin",
            instrumentName: "바이올린",
          },
        ],
      },
      {
        studentId: "student-6",
        studentName: "최도윤",
        instruments: [
          {
            studentInstrumentId: "student-instrument-6",
            instrumentId: "cello",
            instrumentName: "첼로",
          },
        ],
      },
    ],
    teachers: [
      {
        teacherId: "teacher-2",
        teacherName: "오유진",
        part: "바이올린",
      },
      {
        teacherId: "teacher-3",
        teacherName: "문서준",
        part: "첼로",
      },
    ],
  },
  academyMemo: "[2026-08-21] 5시 피아노반 박지호 연락 대기",
  privateMemo: "[2026-08-21] 오유진 선생님 18시 바이올린 개인레슨",
};
