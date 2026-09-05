"use client";

import { Suspense } from "react";

import { AcademySessionGate } from "@/features/auth/academy-session-gate";
import {
  LessonManagementWorkspace,
  type LessonRouteKind,
} from "@/features/lessons/lesson-management-workspace";
import { useDemoAcademy } from "@/lib/demo/academy-demo-provider";

import { AppShell } from "../app-shell";

type LessonPageContentProps = {
  lessonKind: LessonRouteKind;
};

export function LessonPageContent({ lessonKind }: LessonPageContentProps) {
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
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">
                레슨관리표를 준비하는 중입니다.
              </p>
            }
          >
            <LessonManagementWorkspace
              academyId={academy.academyId}
              academyName={academy.academyName}
              lessonKind={lessonKind}
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
                                  enrollment.lessonType === "academy" &&
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
                      privateRegistrationOptions: {
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
                      calendarMemos: [
                        {
                          id: "academy-page-memo-2026-08-21-1",
                          academyId: academy.academyId,
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
                          id: "private-page-memo-2026-08-21-1",
                          academyId: academy.academyId,
                          lessonKind: "private",
                          date: "2026-08-21",
                          content: "바이올린 개인레슨은 발표회 곡 위주로 배정",
                          studentId: null,
                          studentName: null,
                          teacherId: "teacher-2",
                          teacherName: "오유진",
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
          </Suspense>
        </AppShell>
      )}
    </AcademySessionGate>
  );
}
