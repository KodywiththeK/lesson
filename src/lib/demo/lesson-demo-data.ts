import type { DailyAcademyAttendanceSheet } from "@/domain/academy-lesson-attendance";
import type {
  PrivateLesson,
  PrivateLessonTicketSearchBalance,
} from "@/domain/private-lesson";
import type { PrivateLessonRegistrationOptions } from "@/lib/api/private-lessons";
import type { LessonCalendarMemo } from "@/lib/api/lesson-memos";

export type LessonWorkspaceDemoData = {
  academySheets: DailyAcademyAttendanceSheet[];
  privateLessons: PrivateLesson[];
  ticketBalances: PrivateLessonTicketSearchBalance[];
  registrationOptions: PrivateLessonRegistrationOptions;
  privateRegistrationOptions: PrivateLessonRegistrationOptions;
  calendarMemos: LessonCalendarMemo[];
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
          teacherId: "teacher-1",
          teacherName: "김하늘",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-21",
          startTime: "15:00",
          endTime: "15:50",
          status: "present",
          origin: "regular",
          originLabel: "정기",
          markedAt: "2026-08-21T15:55:00+09:00",
        },
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-2",
          studentId: "student-2",
          studentName: "이서윤",
          teacherId: "teacher-1",
          teacherName: "김하늘",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-21",
          startTime: "16:00",
          endTime: "16:50",
          status: "pending",
          origin: "regular",
          originLabel: "정기",
        },
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-3",
          studentId: "student-3",
          studentName: "박지호",
          teacherId: "teacher-1",
          teacherName: "김하늘",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-21",
          startTime: "17:00",
          endTime: "17:50",
          status: "absent",
          origin: "regular",
          originLabel: "정기",
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
          teacherId: "teacher-1",
          teacherName: "김하늘",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-22",
          startTime: "11:00",
          endTime: "11:50",
          status: "pending",
          origin: "special",
          originLabel: "특강",
        },
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-5",
          studentId: "student-7",
          studentName: "강도현",
          teacherId: "teacher-1",
          teacherName: "김하늘",
          instrumentId: "piano",
          instrumentName: "피아노",
          date: "2026-08-22",
          startTime: "13:00",
          endTime: "13:50",
          status: "absent",
          origin: "regular",
          originLabel: "정기",
          absenceReason: "보호자 통화 예정",
          markedAt: "2026-08-22T13:05:00+09:00",
        },
      ],
      absenceQueue: [
        {
          academyId: "academy-demo",
          lessonEventId: "academy-lesson-5",
          studentId: "student-7",
          studentName: "강도현",
          instrumentId: "piano",
          instrumentName: "피아노",
          originalDate: "2026-08-22",
          reason: "보호자 통화 예정",
          markedAt: "2026-08-22T13:05:00+09:00",
        },
      ],
      summary: {
        total: 2,
        present: 0,
        absent: 1,
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
      origin: "private",
      originLabel: "개인레슨",
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
      origin: "private",
      originLabel: "개인레슨",
    },
  ],
  ticketBalances: [
    {
      academyId: "academy-demo",
      studentId: "student-4",
      instrumentId: "violin",
      instrumentName: "바이올린",
      remainingCount: 2,
    },
    {
      academyId: "academy-demo",
      studentId: "student-6",
      instrumentId: "cello",
      instrumentName: "첼로",
      remainingCount: 1,
    },
  ],
  registrationOptions: {
    students: [
      {
        studentId: "student-1",
        studentName: "김민지",
        instruments: [
          {
            studentInstrumentId: "student-instrument-1",
            instrumentId: "piano",
            instrumentName: "피아노",
          },
        ],
      },
      {
        studentId: "student-2",
        studentName: "이서윤",
        instruments: [
          {
            studentInstrumentId: "student-instrument-2",
            instrumentId: "piano",
            instrumentName: "피아노",
          },
        ],
      },
      {
        studentId: "student-3",
        studentName: "박지호",
        instruments: [
          {
            studentInstrumentId: "student-instrument-3",
            instrumentId: "piano",
            instrumentName: "피아노",
          },
        ],
      },
    ],
    teachers: [
      {
        teacherId: "teacher-1",
        teacherName: "김하늘",
        part: "피아노",
      },
    ],
  },
  privateRegistrationOptions: {
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
  calendarMemos: [
    {
      id: "academy-memo-2026-08-21-1",
      academyId: "academy-demo",
      lessonKind: "academy",
      date: "2026-08-21",
      content: "[2026-08-21] 5시 피아노반 박지호 연락 대기",
      studentId: "student-1",
      studentName: "김민지",
      teacherId: "teacher-1",
      teacherName: "김하늘",
      unread: false,
    },
    {
      id: "private-memo-2026-08-21-1",
      academyId: "academy-demo",
      lessonKind: "private",
      date: "2026-08-21",
      content: "[2026-08-21] 오유진 선생님 18시 바이올린 개인레슨",
      studentId: null,
      studentName: null,
      teacherId: "teacher-2",
      teacherName: "오유진",
      unread: false,
    },
  ],
  academyMemo: "[2026-08-21] 5시 피아노반 박지호 연락 대기",
  privateMemo: "[2026-08-21] 오유진 선생님 18시 바이올린 개인레슨",
};
