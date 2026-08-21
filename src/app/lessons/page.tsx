"use client";

import { LessonManagementWorkspace } from "@/features/lessons/lesson-management-workspace";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

const currentAcademy = {
  id: "academy-demo",
  name: "더 클래식",
};

export default function LessonsPage() {
  const demo = useDemoAcademy();

  return (
    <AppShell
      academyName={currentAcademy.name}
      permissionContext={{
        role: "owner",
      }}
      pageTitle="레슨 시간표"
    >
      <LessonManagementWorkspace
        academyId={currentAcademy.id}
        academyName={currentAcademy.name}
        initialDate="2026-08-21"
        demoData={{
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
                      enrollment.lessonType === "private" &&
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
        }}
        onRegisterPrivateLesson={demo.registerPrivateLesson}
        onMarkPrivateLessonAttendance={demo.markPrivateLessonAttendance}
      />
    </AppShell>
  );
}
