"use client";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import { LessonManagementWorkspace } from "@/features/lessons/lesson-management-workspace";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

export default function LessonsPage() {
  const demo = useDemoAcademy();
  const useTestDemo =
    process.env.NODE_ENV === "test" ||
    process.env.NEXT_PUBLIC_E2E_DEMO === "1";

  return (
    <AcademySessionGate>
      {(academy) => (
        <AppShell
          academyName={academy.academyName}
          permissionContext={academy.permissionContext}
          pageTitle="레슨 시간표"
        >
          <LessonManagementWorkspace
            academyId={academy.academyId}
            academyName={academy.academyName}
            initialDate="2026-08-21"
            demoData={
              useTestDemo
                ? {
                    academySheets: Object.values(demo.state.academySheets),
                    privateLessons: demo.state.privateLessons,
                    ticketBalances: demo.state.tickets.map((ticket) => ({
                      academyId: ticket.academyId,
                      studentId: ticket.studentId,
                      instrumentId: ticket.instrumentId,
                      instrumentName: ticket.instrumentName,
                      remainingCount: ticket.remainingCount,
                    })),
                    registrationOptions: {
                      students: demo.state.students
                        .map((student) => ({
                          studentId: student.studentId,
                          studentName: student.name,
                          instruments: demo.state.enrollments
                            .filter(
                              (enrollment) =>
                                enrollment.studentId === student.studentId &&
                                enrollment.active,
                            )
                            .map((enrollment) => ({
                              studentInstrumentId: enrollment.enrollmentId,
                              instrumentId: enrollment.instrumentId,
                              instrumentName: enrollment.instrumentName,
                            })),
                        }))
                        .filter((student) => student.instruments.length > 0),
                      teachers: demo.state.teachers.map((teacher) => ({
                        teacherId: teacher.teacherId,
                        teacherName: teacher.name,
                        part: teacher.part,
                      })),
                    },
                    academyMemo: "[2026-08-21] 5시 피아노반 박지호 연락 대기",
                    privateMemo: "바이올린 개인레슨은 발표회 곡 위주로 배정",
                    calendarMemos: [
                      {
                        academyId: academy.academyId,
                        lessonKind: "academy",
                        date: "2026-08-21",
                        content: "[2026-08-21] 5시 피아노반 박지호 연락 대기",
                        unread: false,
                      },
                      {
                        academyId: academy.academyId,
                        lessonKind: "private",
                        date: "2026-08-21",
                        content: "바이올린 개인레슨은 발표회 곡 위주로 배정",
                        unread: false,
                      },
                    ],
                  }
                : undefined
            }
            onRegisterPrivateLesson={
              useTestDemo ? demo.registerPrivateLesson : undefined
            }
            onMarkPrivateLessonAttendance={
              useTestDemo ? demo.markPrivateLessonAttendance : undefined
            }
          />
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
