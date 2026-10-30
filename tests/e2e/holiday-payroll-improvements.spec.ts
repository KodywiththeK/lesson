import { expect, test } from "@playwright/test";

test("휴일 설정은 데스크톱과 모바일에서 각각 변경할 수 있다", async ({ page }, testInfo) => {
  await page.goto("/settings/lesson-schedule");
  const publicHoliday = page.getByRole("checkbox", { name: "공휴일은 정기 수업에서 제외" });
  const academyHoliday = page.getByRole("checkbox", { name: "학원 휴원일은 정기 수업에서 제외" });
  await expect(publicHoliday).toBeChecked();
  await expect(academyHoliday).toBeChecked();
  await publicHoliday.uncheck();
  await expect(publicHoliday).not.toBeChecked();
  await expect(academyHoliday).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("holiday-settings-desktop.png") });
  await page.setViewportSize({ width: 320, height: 720 });
  await academyHoliday.uncheck();
  await expect(academyHoliday).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("holiday-settings-mobile.png") });
});

test("월급 행의 정산 문자는 모바일에서도 편집할 수 있다", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/finance/payroll");
  await page.getByRole("button", { name: /정산 문자 작성/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "정산 문자 작성" });
  await expect(dialog.getByLabel("정산 문자 내용")).toBeVisible();
  await dialog.getByLabel("정산 문자 내용").fill("정산 내용 확인 부탁드립니다.");
  await expect(dialog.getByRole("button", { name: "복사" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath("payroll-message-mobile.png") });
});
