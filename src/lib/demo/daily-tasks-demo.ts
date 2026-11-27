import type { DailyTaskSource, DailyTaskState } from "@/domain/daily-tasks";
import { addDays } from "@/domain/finance-date";
import type { BookOrder } from "@/domain/book-order";
import type { TodayTaskProcessing } from "@/features/dashboard/today-task-processing";
import type { TodayTasksDataAccess } from "@/features/dashboard/today-tasks";

/** 데모·E2E용 오늘 할 일. 날짜는 '오늘'을 기준으로 만들어 언제 열어도 할 일이 보인다. */
function createDemoDailyTaskSource(today: string): DailyTaskSource {
  const yesterday = addDays(today, -1);
  const lastWeek = addDays(today, -9);

  return {
    unresolvedAbsences: [
      {
        attendanceId: "demo-absence-1",
        lessonEventId: "demo-lesson-1",
        lessonDate: yesterday,
        startsAt: `${yesterday}T06:00:00.000Z`,
        endsAt: `${yesterday}T06:50:00.000Z`,
        studentId: "student-1",
        studentName: "김민지",
        teacherIds: ["teacher-1"],
        teacherName: "박선생",
        instrumentId: "piano",
        instrumentName: "피아노",
        origin: "regular",
        absenceReason: null,
        regularWeekdays: [1, 3],
        contact: { relationship: "어머니", phone: "010-1111-2222" },
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
        contact: { relationship: "아버지", phone: "010-3333-4444" },
      },
    ],
    lessonTickets: [
      {
        grantId: "demo-ticket-1",
        studentId: "student-3",
        instrumentId: "violin",
        studentName: "최도윤",
        instrumentName: "바이올린",
        paymentStatus: "paid",
        dueOn: lastWeek,
        remainingCount: 1,
        validUntil: addDays(today, 30),
        amount: 320000,
        contact: { relationship: "어머니", phone: "010-5555-6666" },
      },
      {
        grantId: "demo-ticket-2",
        studentId: "student-4",
        instrumentId: "cello",
        studentName: "윤하린",
        instrumentName: "첼로",
        paymentStatus: "payment-pending",
        dueOn: today,
        remainingCount: 8,
        validUntil: addDays(today, 60),
        amount: 280000,
        contact: null,
      },
    ],
    unpaidBookReleases: [
      { releaseId: "demo-release-1", studentName: "이서윤", bookTitle: "바이엘 3", shippedAt: lastWeek, amount: 9000 },
    ],
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
        contact: { relationship: "어머니", phone: "010-7777-8888" },
      },
    ],
    consultations: [
      {
        consultationId: "demo-consultation-1",
        name: "정다은",
        createdAt: `${yesterday}T03:00:00.000Z`,
        phone: "010-2468-1357",
        instrumentNames: ["피아노"],
      },
    ],
    pendingBookOrders: [{ orderId: "demo-order-1", vendorName: "세광음악", orderedOn: lastWeek }],
  };
}

/** 데모·E2E용 오늘 할 일과 모달 처리. 처리하면 데모 원천에서 그 건을 빼서 칸 건수가 줄어든다. */
export function createDemoDailyTasks(today: string): { dataAccess: TodayTasksDataAccess; processing: TodayTaskProcessing } {
  let source = createDemoDailyTaskSource(today);
  let states: DailyTaskState[] = [];

  return {
    dataAccess: {
      loadSource: async () => source,
      loadStates: async () => states,
      saveState: async ({ taskKey, state }) => {
        states = states.filter((item) => item.taskKey !== taskKey);
        if (state) {
          states = [...states, { taskKey, state, updatedByName: "원장", updatedAt: new Date().toISOString() }];
        }
      },
    },
    processing: {
      loadCardFeeRates: async () => [],
      markTuitionPaid: async ({ snapshotId }) => {
        source = { ...source, tuitions: source.tuitions.filter((item) => item.snapshotId !== snapshotId) };
      },
      changeTicketPayment: async ({ ticketId, action }) => {
        if (action === "mark-paid") {
          source = {
            ...source,
            lessonTickets: source.lessonTickets.map((ticket) =>
              ticket.grantId === ticketId ? { ...ticket, paymentStatus: "paid" } : ticket,
            ),
          };
        }
      },
      loadBookOrder: async (orderId): Promise<BookOrder | null> => {
        const order = source.pendingBookOrders.find((item) => item.orderId === orderId);
        return order
          ? {
              id: order.orderId,
              academyId: "demo-academy",
              vendorId: "demo-vendor",
              vendorName: order.vendorName,
              orderedOn: order.orderedOn,
              receivedOn: null,
              paidOn: null,
              paidLedgerEntryId: null,
              ledgerMismatch: false,
              status: "ordered",
              items: [
                { id: "demo-item-1", bookId: "demo-book-1", title: "바이엘 3", quantity: 2, purchasePrice: 7000, salePrice: 9000 },
              ],
            }
          : null;
      },
      receiveBookOrder: async ({ orderId }) => {
        source = { ...source, pendingBookOrders: source.pendingBookOrders.filter((item) => item.orderId !== orderId) };
      },
      loadTicketRegistrationOptions: async () => [
        { studentId: "student-3", studentName: "최도윤", instruments: [{ instrumentId: "violin", instrumentName: "바이올린" }] },
      ],
      registerLessonTicket: async ({ studentId }) => {
        source = { ...source, lessonTickets: source.lessonTickets.filter((item) => item.studentId !== studentId) };
      },
      loadAttendeeCounts: async () => ({}),
      resolveAbsence: async ({ sourceLessonEventId }) => {
        source = {
          ...source,
          unresolvedAbsences: source.unresolvedAbsences.filter((item) => item.lessonEventId !== sourceLessonEventId),
        };
      },
    },
  };
}
