import { expect, test } from "@playwright/test";

test("원장 가입 신청은 데스크톱과 모바일에서 같은 정보·작업을 제공한다", async ({ page }) => {
  let approved = false;
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    const result = name === "list_owner_academy_join_requests"
      ? approved ? [] : [{ id: "request-1", applicant_name: "김선생", applicant_phone: "01012345678", source: "code", status: "pending", created_at: "2026-10-26" }]
      : name === "list_academy_staff"
        ? approved ? [{ member_id: "member-1", display_name: "김선생", phone: "01012345678", role: "desk", status: "active", teacher_id: null }] : []
        : name === "list_academy_join_invites" ? [] : null;
    if (name === "review_academy_join_request") approved = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.route("**/rest/v1/teachers?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  await page.goto("/settings/members");
  const requestTable = page.getByRole("table", { name: "가입 신청 목록" });
  await expect(requestTable.getByText("김선생")).toBeVisible();
  await expect(requestTable.getByText("01012345678")).toBeVisible();
  await expect(requestTable.getByText("학원 코드")).toBeVisible();
  await expect(requestTable.getByRole("button", { name: "김선생 승인" })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(requestTable.getByText("김선생")).toBeVisible();
  await expect(requestTable.getByText("01012345678")).toBeVisible();
  await expect(requestTable.getByText("학원 코드")).toBeVisible();
  await requestTable.getByRole("button", { name: "김선생 승인" }).click();
  await expect(page.getByRole("table", { name: "직원 목록" }).getByText("김선생")).toBeVisible();
});
