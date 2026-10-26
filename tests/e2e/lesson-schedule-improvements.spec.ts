import { expect, test } from "@playwright/test";

test("개인레슨 달력과 시간표 설정이 데스크톱에서 보인다", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/lessons/private");
  const calendar = page.getByRole("grid", { name: /개인레슨 캘린더/ });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("예정", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "시간표 설정" }).click();
  const dialog = page.getByRole("dialog", { name: "레슨 시간표 설정" });
  await expect(dialog.getByRole("button", { name: /기본 색/ })).toHaveCount(8);
  await expect(dialog.getByLabel("직접 색상 선택")).toBeVisible();
  await expect(dialog.getByLabel("휴원 종류")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath("private-calendar-settings-desktop.png") });
});

test("모바일에서도 악기별 색상과 휴원일 설정을 열 수 있다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/lessons/private");
  await page.getByRole("button", { name: "작업 메뉴 열기" }).click();
  await page.getByRole("dialog", { name: "페이지 작업" }).getByRole("button", { name: "시간표 설정" }).click();
  const dialog = page.getByRole("dialog", { name: "레슨 시간표 설정" });
  await expect(page.locator('[data-slot="sheet-content"][data-state="open"]')).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "기본 색 8" })).toBeVisible();
  await dialog.getByLabel("휴원 종류").selectOption("weekly");
  await expect(dialog.getByLabel("반복 요일")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath("private-calendar-settings-mobile.png") });
});

test("회차권 등록은 악기를 선택한 뒤 원생을 고른다", async ({ page }) => {
  await page.goto("/passes");
  await page.getByRole("button", { name: "회차권 등록" }).click();
  const dialog = page.getByRole("dialog", { name: "회차권 등록" });
  await expect(dialog.getByLabel("원생")).toBeDisabled();
  await dialog.getByLabel("악기").selectOption("violin");
  await expect(dialog.getByRole("option", { name: "한서아" })).toBeAttached();
});
