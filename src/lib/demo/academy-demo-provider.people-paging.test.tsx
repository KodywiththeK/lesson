import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { demoAcademyId } from "./management-demo-data";
import { DemoAcademyProvider, useDemoAcademy } from "./academy-demo-provider";

function renderDemoAcademy() {
  return renderHook(() => useDemoAcademy(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DemoAcademyProvider>{children}</DemoAcademyProvider>
    ),
  }).result.current;
}

describe("데모 학원 provider의 원생·선생님·휴원/퇴원 목록 queryKey", () => {
  it("원생 목록은 페이지나 페이지당 개수가 바뀌면 다른 queryKey를 쓴다", () => {
    const demo = renderDemoAcademy();
    const options = { academyId: demoAcademyId };

    const firstPage = demo.createStudentListQueryOptions({ ...options, page: 1, pageSize: 10 });
    const secondPage = demo.createStudentListQueryOptions({ ...options, page: 2, pageSize: 10 });
    const largerPageSize = demo.createStudentListQueryOptions({ ...options, page: 1, pageSize: 20 });

    expect(secondPage.queryKey).not.toEqual(firstPage.queryKey);
    expect(largerPageSize.queryKey).not.toEqual(firstPage.queryKey);
  });

  it("선생님 목록은 페이지나 페이지당 개수가 바뀌면 다른 queryKey를 쓴다", () => {
    const demo = renderDemoAcademy();
    const options = { academyId: demoAcademyId };

    const firstPage = demo.createTeacherListQueryOptions({ ...options, page: 1, pageSize: 10 });
    const secondPage = demo.createTeacherListQueryOptions({ ...options, page: 2, pageSize: 10 });
    const largerPageSize = demo.createTeacherListQueryOptions({ ...options, page: 1, pageSize: 20 });

    expect(secondPage.queryKey).not.toEqual(firstPage.queryKey);
    expect(largerPageSize.queryKey).not.toEqual(firstPage.queryKey);
  });

  it("휴원/퇴원 관리 목록은 검색어와 페이지가 바뀌면 다른 queryKey를 쓴다", () => {
    const demo = renderDemoAcademy();
    const studentOptions = { academyId: demoAcademyId, status: "suspended" as const };
    const teacherOptions = { academyId: demoAcademyId, status: "on_leave" as const };

    const students = demo.createStudentStatusManagementQueryOptions({ ...studentOptions, page: 1 });
    const searchedStudents = demo.createStudentStatusManagementQueryOptions({
      ...studentOptions,
      search: "박",
      page: 1,
    });
    const teachers = demo.createTeacherStatusManagementQueryOptions({ ...teacherOptions, page: 1 });
    const secondTeacherPage = demo.createTeacherStatusManagementQueryOptions({
      ...teacherOptions,
      page: 2,
    });

    expect(searchedStudents.queryKey).not.toEqual(students.queryKey);
    expect(secondTeacherPage.queryKey).not.toEqual(teachers.queryKey);
  });

  it("휴원/퇴원 관리 목록은 검색어에 맞는 대상만 돌려준다", async () => {
    const demo = renderDemoAcademy();

    const all = await demo
      .createStudentStatusManagementQueryOptions({
        academyId: demoAcademyId,
        status: "suspended",
      })
      .queryFn();
    const searched = await demo
      .createStudentStatusManagementQueryOptions({
        academyId: demoAcademyId,
        status: "suspended",
        search: "박지호",
      })
      .queryFn();

    expect(all.totalItems).toBeGreaterThan(0);
    expect(searched.items.map((item) => item.name)).toEqual(["박지호"]);
  });
});
