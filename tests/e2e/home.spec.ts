import { expect, test, type Page } from "@playwright/test";

// 홈의 바로가기 카드에도 같은 이름의 링크가 있어 사이드바 안에서만 찾는다.
function mainNavigation(page: Page) {
  return page.getByRole("navigation", { name: "주요 메뉴" });
}

test("첫 화면에서 운영 대시보드와 주요 메뉴를 확인할 수 있다", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "음악학원 관리" }),
  ).toBeVisible();
  await expect(page.getByText("현재 학원: 더 클래식")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "바로가기" }).getByRole("link", { name: /수입 관리/ }),
  ).toBeVisible();
  await expect(page.getByText("우선 개발 흐름")).toHaveCount(0);

  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });

  await expect(navigation.getByRole("link", { name: /레슨 시간표/ })).toHaveAttribute(
    "href",
    "/lessons/academy",
  );
  await expect(navigation.getByRole("link", { name: /회차권/ })).toHaveAttribute(
    "href",
    "/passes",
  );
});

test("원생 메뉴에서 원생 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await expect(mainNavigation(page).getByRole("link", { name: "인원·거래처" })).toHaveAttribute(
    "href",
    "/management/students",
  );
  await mainNavigation(page).getByRole("link", { name: "원생" }).click();
  await expect(page).toHaveURL(/\/management\/students$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "원생 검색" })).toBeVisible();
});

test("레슨 시간표 메뉴에서 개인레슨 등록 화면으로 이동할 수 있다", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-05T12:00:00+09:00"));
  await page.goto("/");

  await mainNavigation(page).getByRole("link", { name: "레슨 시간표" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "레슨 시간표" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "레슨관리표" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("레슨 관리 날짜")).toHaveCount(0);
  const academyCalendar = page.getByRole("grid", {
    name: "2026년 9월 학원레슨 캘린더",
  });
  await expect(academyCalendar).toBeVisible();
  const todayCell = academyCalendar.getByRole("gridcell", { name: /5 오늘/ });
  await expect(todayCell).toHaveAttribute("aria-current", "date");
  await todayCell.click();
  const attendanceDialog = page.getByRole("dialog", { name: "2026-09-05 출석 확인" });
  await expect(attendanceDialog.getByRole("tab", { name: "출석관리" })).toBeVisible();
  await expect(
    attendanceDialog.getByRole("tab", { name: "메모 0" }),
  ).toBeVisible();
  await attendanceDialog.getByRole("tab", { name: "메모 0" }).click();
  await expect(attendanceDialog.getByLabel("메모 대상 유형")).toHaveCount(0);
  await expect(attendanceDialog.getByLabel("관련 원생")).toBeVisible();
  await expect(attendanceDialog.getByLabel("관련 선생님")).toBeVisible();
  await expect(attendanceDialog.getByLabel("메모 내용")).toBeVisible();
  await page.keyboard.press("Escape");

  await page
    .getByRole("navigation", { name: "레슨 시간표 하위 메뉴" })
    .getByRole("link", { name: "개인레슨표" })
    .click();
  await expect(page).toHaveURL(/\/lessons\/private$/);
  await expect(
    page.getByRole("grid", { name: "2026년 9월 개인레슨 캘린더" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "레슨원생 검색" }).click();
  const searchDialog = page.getByRole("dialog", { name: "레슨원생 검색 및 선택" });
  await expect(searchDialog.getByText("한서아")).toBeVisible();
  await expect(searchDialog.getByText("바이올린 2회")).toBeVisible();
  await expect(searchDialog.getByText("김민지")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "개인레슨 등록" }).click();
  await expect(page.getByRole("dialog", { name: "레슨 일정 등록" })).toBeVisible();
});

test("학원레슨 달력은 각 화면 폭에서 넘치지 않고 월별 메모지는 오늘로 이동 옆에 있다", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00+09:00"));
  for (const width of [320, 480, 767, 768, 1023, 1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/lessons/academy");
    const calendar = page.getByRole("grid", { name: "2026년 10월 학원레슨 캘린더" });
    await expect(calendar).toBeVisible();
    await expect(page.getByRole("complementary", { name: /선택 날짜/ })).toHaveCount(0);
    await expect.poll(async () => Boolean(await calendar.boundingBox())).toBe(true);
    const calendarBox = await calendar.boundingBox();
    expect(calendarBox).not.toBeNull();
    if (width >= 1280) {
      // 오른쪽 패널이 없어 달력이 본문 폭을 거의 다 쓴다.
      expect(calendarBox!.width).toBeGreaterThanOrEqual(900);
    }
    const memoButton = page.getByRole("button", { name: "10월 메모지" });
    const todayButton = page.getByRole("button", { name: "오늘로 이동" });
    const memoBox = await memoButton.boundingBox();
    const todayBox = await todayButton.boundingBox();
    expect(memoBox).not.toBeNull();
    expect(todayBox).not.toBeNull();
    if (width >= 768) {
      // 한 줄에서 오늘로 이동 바로 오른쪽에 붙어 있다.
      expect(Math.abs(memoBox!.y - todayBox!.y)).toBeLessThanOrEqual(16);
      expect(memoBox!.x).toBeGreaterThanOrEqual(todayBox!.x + todayBox!.width);
      // 보기 전환 탭은 높이 48px로 키웠다.
      const tabsBox = await page.getByRole("tablist").boundingBox();
      expect(tabsBox!.height).toBeGreaterThanOrEqual(47);
    }
    const calendarContainerBox = await calendar.locator("..").boundingBox();
    expect(todayBox).not.toBeNull();
    expect(calendarContainerBox).not.toBeNull();
    expect(todayBox!.x + todayBox!.width).toBeLessThanOrEqual(calendarContainerBox!.x + calendarContainerBox!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if ([320, 768, 1024].includes(width)) {
      await page.screenshot({ path: testInfo.outputPath(`academy-calendar-${width}.png`) });
    }
  }
});

test("메모지는 다이얼로그로 열리고 출석 확인 모달은 화면 높이의 60% 이상으로 보인다", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00+09:00"));
  for (const route of ["/lessons/academy", "/lessons/private"]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(route);

    await page.getByRole("button", { name: "10월 메모지" }).click();
    const memo = page.getByRole("dialog", { name: /^10월 .*레슨 메모지$/ });
    await expect(memo).toBeVisible();
    await expect(memo.getByRole("textbox", { name: "10월 메모 내용" })).toBeVisible();
    await memo.getByRole("button", { name: "닫기" }).click();
    await expect(memo).toBeHidden();

    await page.getByRole("gridcell", { name: "2026-10-16" }).click();
    const day = page.getByRole("dialog", { name: /2026-10-16 .*출석 확인/ });
    await expect(day).toBeVisible();
    // 열림 애니메이션 중에는 크기가 달라 보이므로 계산된 최소 높이로 확인한다(900px의 60%).
    await expect(day).toHaveCSS("min-height", "540px");
  }
});

test("일별 테이블뷰는 모달 없이 날짜를 옮기고 그날의 메모지를 연다", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00+09:00"));
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [route, prefix] of [
    ["/lessons/academy", "학원레슨"],
    ["/lessons/private", "개인레슨"],
  ] as const) {
    await page.goto(route);
    await page.getByRole("tab", { name: `${prefix} 일별 테이블뷰` }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "10월 16일 메모지" })).toBeVisible();

    await page.getByRole("button", { name: /다음 날짜$/ }).click();
    await expect(page.getByRole("button", { name: "10월 17일 메모지" })).toBeVisible();
    await page.getByRole("button", { name: /이전 날짜$/ }).click();
    await page.getByRole("button", { name: /이전 날짜$/ }).click();
    await expect(page.getByRole("button", { name: "10월 15일 메모지" })).toBeVisible();

    await page.getByRole("button", { name: "오늘로 이동" }).click();
    await page.getByRole("button", { name: "10월 16일 메모지" }).click();
    const memo = page.getByRole("dialog", { name: /^10월 16일 .*레슨 메모지$/ });
    await expect(memo).toBeVisible();
    await memo.getByRole("button", { name: "Close" }).click();
    await expect(memo).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  }
});

test("회차권 메뉴에서 회차권 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await mainNavigation(page).getByRole("link", { name: "회차권" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "회차권 관리" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "회차권 검색" })).toBeVisible();

  await page.getByRole("button", { name: "회차권 등록" }).click();
  await expect(page.getByRole("dialog", { name: "회차권 등록" })).toBeVisible();
});

test("320px 화면에서 회차권 목록과 등록·수정 다이얼로그를 사용할 수 있다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/passes");

  const ticketTable = page.getByRole("table", { name: "회차권 목록" });
  await expect(ticketTable).toBeVisible();
  await expect(ticketTable.locator('[data-label="남은 일수"]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await ticketTable.getByRole("button", { name: /회차권 수정/ }).first().click();
  const adjustDialog = page.getByRole("dialog", { name: "회차권 수정" });
  await expect(adjustDialog).toBeVisible();
  await adjustDialog.getByRole("button", { name: "저장" }).scrollIntoViewIfNeeded();
  await expect(adjustDialog.getByRole("button", { name: "저장" })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("lesson-tickets-320-adjust.png") });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "작업 메뉴 열기" }).click();
  await page.getByRole("dialog", { name: "페이지 작업" }).getByRole("button", { name: "회차권 등록" }).click();
  const registrationDialog = page.getByRole("dialog", { name: "회차권 등록" });
  await expect(registrationDialog).toBeVisible();
  await expect(page.locator('[data-slot="sheet-content"][data-state="open"]')).toHaveCount(0);
  await registrationDialog.getByRole("button", { name: "저장" }).scrollIntoViewIfNeeded();
  await expect(registrationDialog.getByRole("button", { name: "저장" })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("lesson-tickets-320-register.png") });
});

test("회차권 표는 화면 폭에 따라 데스크톱 표·태블릿 행·모바일 카드로 바뀐다", async ({ page }, testInfo) => {
  await page.goto("/passes");
  const table = page.getByRole("table", { name: "회차권 목록" });
  await expect(table).toBeVisible();

  for (const width of [320, 480, 481, 767, 768, 1023, 1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await table.evaluate((element) => ({
      tableDisplay: getComputedStyle(element).display,
      bodyColumns: getComputedStyle(element.querySelector("tbody")!).gridTemplateColumns.split(" ").length,
    }));
    expect(layout.tableDisplay).toBe(width >= 1024 ? "table" : "block");
    if (width < 768) {
      expect(layout.bodyColumns).toBe(width <= 480 ? 1 : 2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const filterBox = await page.getByLabel("회차권 상태 필터").boundingBox();
    expect(filterBox).not.toBeNull();
    expect(filterBox!.x + filterBox!.width).toBeLessThanOrEqual(width);
    if ([320, 481, 768, 1024].includes(width)) {
      await page.screenshot({ path: testInfo.outputPath(`lesson-tickets-${width}.png`) });
    }
  }
});

test("관리·재무 목록은 작은 화면에서도 항목명과 표 작업을 유지한다", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  for (const route of [
    "/management/students",
    "/management/teachers",
    "/management/vendors",
    "/management/consultations",
    "/management/status",
    "/books",
    "/books/shipments",
    "/books/paid",
    "/finance/ledger",
    "/finance/lesson-income",
    "/finance/books",
    "/finance/payroll",
  ]) {
    for (const width of [320, 481, 768, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route);
      const table = page.locator("[data-responsive-table]").first();
      await expect(table).toBeVisible();
      const tableBox = await table.boundingBox();
      expect(tableBox).not.toBeNull();
      expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await table.locator('[data-slot="table-cell"]:not([colspan]):not([data-label])').count()).toBe(0);
      if (
        (width === 320 && ["/management/teachers", "/management/status", "/finance/ledger"].includes(route)) ||
        (width === 481 && route === "/finance/lesson-income")
      ) {
        await table.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll("/", "-")}-${width}.png`) });
      }
    }
  }
});

test("선생님 메뉴에서 선생님 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await mainNavigation(page).getByRole("link", { name: "선생님", exact: true }).click();
  await expect(page).toHaveURL(/\/management\/teachers$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "선생님 검색" }),
  ).toBeVisible();
});

test("휴원/퇴원 메뉴에서 비활성 원생과 선생님을 관리할 수 있다", async ({
  page,
}) => {
  await page.goto("/");

  await mainNavigation(page).getByRole("link", { name: "휴원/퇴원" }).click();
  await expect(page).toHaveURL(/\/management\/status$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(page.getByText("박지호")).toBeVisible();

  await page.getByRole("button", { name: "박지호 재원 처리" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "상태 변경 확인" }),
  ).toBeVisible();
  await expect(page.getByLabel("상태 변경 메모")).toHaveCount(0);
  await page.getByRole("button", { name: "취소" }).click();

  await page.getByRole("tab", { name: "퇴원" }).click();
  await expect(page.getByText("유하린")).toBeVisible();
  await expect(page.getByText("2026-09-10")).toBeVisible();

  await page.getByRole("tab", { name: "선생님" }).click();
  await expect(page.getByText("문서준")).toBeVisible();
  await page.getByRole("tab", { name: "퇴사" }).click();
  await expect(page.getByText("정예린")).toBeVisible();
});

test("거래처 메뉴에서 거래처 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await mainNavigation(page).getByRole("link", { name: "거래처", exact: true }).click();
  await expect(page).toHaveURL(/\/management\/vendors$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "거래처 검색" }),
  ).toBeVisible();
});

test("상담 메뉴에서 상담 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await mainNavigation(page).getByRole("link", { name: "상담", exact: true }).click();
  await expect(page).toHaveURL(/\/management\/consultations$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "상담 검색" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "정다은 원생 등록" })).toBeVisible();
});

test("교재 메뉴에서 재고, 출고, 결제 완료 탭으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await mainNavigation(page).getByRole("link", { name: "교재", exact: true }).click();

  await expect(page).toHaveURL(/\/books$/);
  await expect(page.getByRole("heading", { level: 1, name: "교재" })).toBeVisible();
  await expect(page.getByRole("table", { name: "교재 재고 목록" })).toBeVisible();

  await mainNavigation(page).getByRole("link", { name: "출고", exact: true }).click();
  await expect(page).toHaveURL(/\/books\/shipments$/);
  await expect(page.getByRole("table", { name: "출고 목록" })).toBeVisible();

  await mainNavigation(page).getByRole("link", { name: "결제 완료", exact: true }).click();
  await expect(page).toHaveURL(/\/books\/paid$/);
});

test("작은 모바일에서 교재 쉼표 금액을 입력하고 출고의 나중 결제 버튼은 보이지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/books");
  await page.getByRole("button", { name: "작업 메뉴 열기" }).click();
  await page.getByRole("dialog", { name: "페이지 작업" }).getByRole("button", { name: "교재 등록" }).click();

  const dialog = page.getByRole("dialog", { name: "교재 등록" });
  const price = dialog.getByRole("textbox", { name: "가격(원)" });
  await price.fill("140,000");
  await expect(price).toHaveValue("140,000");
  await expect(dialog.getByRole("button", { name: "등록" })).toBeVisible();

  await page.goto("/books/shipments");
  await expect(page.getByRole("button", { name: /결제 완료 처리/ })).toHaveCount(0);
});

test("데모의 발주·입고 탭은 운영 DB를 호출하지 않고 빈 목록을 보여 준다", async ({ page }) => {
  await page.goto("/books/orders");
  await expect(page.getByText("발주 내역이 없습니다.")).toBeVisible();
  await expect(page.getByText("교재 발주를 불러오지 못했습니다.")).toHaveCount(0);
});

test("수입 관리 메뉴는 학원 고정 수입을 기본으로 열고 입출입내역 탭으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await mainNavigation(page).getByRole("link", { name: "수입 관리" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "수입 관리" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/finance\/lesson-income/);
  await expect(
    page.getByRole("heading", { name: "학원 고정 수입 (원생 레슨 수입)" }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "수입 관리 하위 메뉴" })
    .getByRole("link", { name: "입출입내역" })
    .click();

  await expect(page).toHaveURL(/\/finance\/ledger/);
  await expect(
    page.getByRole("searchbox", { name: "입출금 내역 검색" }),
  ).toBeVisible();
});

test("좁은 화면에서도 고정 수입과 입금 액션을 가로 잘림 없이 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/finance/lesson-income");

  await expect(page.getByRole("heading", { level: 1, name: "수입 관리" })).toBeVisible();
  await expect(page.getByRole("button", { name: "김민지 피아노 입금 처리" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("모바일에서도 미납 인원 다이얼로그를 열 수 있다", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/finance/lesson-income");
  await page.getByRole("button", { name: /미납 인원/ }).click();
  await expect(page.getByRole("dialog", { name: "미납 인원" })).toBeVisible();
});

async function openPageAction(page: Page, name: string, isNarrow: boolean) {
  if (isNarrow) {
    await page.getByRole("button", { name: "작업 메뉴 열기" }).click();
  }
  await page.getByRole("button", { name }).first().click();
}

for (const viewport of [
  { name: "데스크톱", width: 1280, height: 800 },
  { name: "320px 모바일", width: 320, height: 640 },
]) {
  test(`${viewport.name}에서 다이얼로그 안 날짜·일시 선택기를 클릭해 값을 고를 수 있다`, async ({ page }) => {
    const isNarrow = viewport.width < 768;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/finance/ledger");

    await openPageAction(page, "수동 입출금 등록", isNarrow);
    const dialog = page.getByRole("dialog", { name: "수동 입출금 등록" });
    const trigger = dialog.getByRole("button", { name: "발생일 달력 열기" });
    await trigger.click();
    const triggerBox = await trigger.boundingBox();
    const popoverBox = await page.locator('[data-slot="popover-content"]').boundingBox();
    expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(triggerBox!.x + triggerBox!.width + 1);
    await page.getByRole("button", { name: /\d{4}년 \d{1,2}월 15일/ }).click();

    await expect(dialog.getByRole("textbox", { name: "발생일" })).toHaveValue(/^\d{4}-\d{2}-15$/);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await page.goto("/lessons/academy");
    await openPageAction(page, "일정 추가", isNarrow);
    const eventDialog = page.getByRole("dialog", { name: "학원 일정 추가" });
    await eventDialog.getByRole("button", { name: "시작 시간 달력 열기" }).click();
    await page.getByRole("button", { name: /\d{4}년 \d{1,2}월 20일/ }).click();
    await page.getByRole("combobox", { name: "시" }).selectOption("09");
    await page.getByRole("combobox", { name: "분" }).selectOption("05");

    await expect(eventDialog.getByRole("textbox", { name: "시작 시간" })).toHaveValue(/^\d{4}-\d{2}-20T09:05$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
