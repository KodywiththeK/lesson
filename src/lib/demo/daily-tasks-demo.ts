import type { DailyTaskSource, DailyTaskState } from "@/domain/daily-tasks";
import { addDays } from "@/domain/finance-date";
import type { TodayTasksDataAccess } from "@/features/dashboard/today-tasks";

/** 데모·E2E용 오늘 할 일. 날짜는 '오늘'을 기준으로 만들어 언제 열어도 할 일이 보인다. */
export function createDemoDailyTaskSource(today: string): DailyTaskSource {
  const yesterday = addDays(today, -1);
  const lastWeek = addDays(today, -9);

  return {
    unresolvedAbsences: [
      {
        attendanceId: "demo-absence-1",
        lessonDate: yesterday,
        studentId: "student-1",
        studentName: "김민지",
        teacherIds: ["teacher-1"],
        instrumentName: "피아노",
      },
    ],
    tuitions: [
      {
        snapshotId: "demo-tuition-1",
        studentName: "이서윤",
        instrumentName: "피아노",
        month: today.slice(0, 7),
        dueOn: lastWeek,
        status: "unpaid",
        amount: 150000,
      },
    ],
    lessonTickets: [
      {
        grantId: "demo-ticket-1",
        studentName: "최도윤",
        instrumentName: "바이올린",
        paymentStatus: "paid",
        dueOn: lastWeek,
        remainingCount: 1,
        validUntil: addDays(today, 30),
        amount: 320000,
      },
    ],
    unpaidBookReleases: [],
    lessonChanges: [
      {
        auditEventId: "demo-change-1",
        changeType: "rescheduled",
        lessonKind: "academy",
        studentName: "한서아",
        teacherIds: ["teacher-1"],
        previousStartsAt: `${today}T05:00:00.000Z`,
        nextStartsAt: `${today}T06:30:00.000Z`,
        previousTeacherName: null,
        nextTeacherName: null,
      },
    ],
    consultations: [{ consultationId: "demo-consultation-1", name: "정다은", createdAt: `${yesterday}T03:00:00.000Z` }],
    pendingBookOrders: [],
  };
}

export function createDemoDailyTasksAccess(today: string): TodayTasksDataAccess {
  let states: DailyTaskState[] = [];

  return {
    loadSource: async () => createDemoDailyTaskSource(today),
    loadStates: async () => states,
    saveState: async ({ taskKey, state }) => {
      states = states.filter((item) => item.taskKey !== taskKey);
      if (state) {
        states = [...states, { taskKey, state, updatedByName: "원장", updatedAt: new Date().toISOString() }];
      }
    },
  };
}
