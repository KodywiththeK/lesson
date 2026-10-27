import { expect, test } from "@playwright/test";

test("개인레슨 달력에서 설정을 분리하고 데스크톱 설정 메뉴에서 연다", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/lessons/private");
  const calendar = page.getByRole("grid", { name: /개인레슨 캘린더/ });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("예정", { exact: true }).first()).toBeVisible();

  await expect(page.getByRole("button", { name: "시간표 설정" })).toHaveCount(0);
  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
  await navigation.getByRole("button", { name: "설정 하위 메뉴 펼치기" }).click();
  await navigation.getByRole("link", { name: "레슨시간표" }).click();
  const settings = page.getByRole("region", { name: "레슨시간표 설정" });
  await expect(settings.getByRole("button", { name: /기본 색/ })).toHaveCount(8);
  await expect(settings.getByLabel("직접 색상 선택")).toBeVisible();
  await expect(settings.getByLabel("휴원 종류")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("private-calendar-settings-desktop.png") });
});

test("모바일 설정 메뉴에서도 악기별 색상과 휴원일을 설정할 수 있다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/lessons/private");
  await expect(page.getByRole("button", { name: "시간표 설정" })).toHaveCount(0);
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  const navigation = page.getByRole("dialog", { name: "주요 메뉴" }).getByRole("navigation", { name: "모바일 주요 메뉴" });
  await navigation.getByRole("button", { name: "설정 하위 메뉴 펼치기" }).click();
  await navigation.getByRole("link", { name: "레슨시간표" }).click();
  const settings = page.getByRole("region", { name: "레슨시간표 설정" });
  await expect(settings.getByRole("button", { name: "기본 색 8" })).toBeVisible();
  await settings.getByLabel("휴원 종류").selectOption("weekly");
  await expect(settings.getByLabel("반복 요일")).toBeVisible();
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
