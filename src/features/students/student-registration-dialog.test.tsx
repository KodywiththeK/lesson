import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TeacherListRow } from "@/domain/teacher-list";

import { StudentRegistrationDialog } from "./student-registration-dialog";

const teachers: TeacherListRow[] = [
  {
    academyId: "academy-1",
    teacherId: "teacher-1",
    name: "박선생",
    part: "피아노",
    contact: "010-1111-1111",
    registeredAt: "2026-08-01",
    payType: "monthly",
  },
  {
    academyId: "academy-1",
    teacherId: "teacher-2",
    name: "최선생",
    part: "바이올린",
    contact: "010-2222-2222",
    registeredAt: "2026-08-02",
    payType: "hourly",
  },
];

function renderDialog(
  props: Partial<React.ComponentProps<typeof StudentRegistrationDialog>> = {},
) {
  return render(
    <StudentRegistrationDialog
      open
      onOpenChange={vi.fn()}
      teachers={teachers}
      onSubmit={vi.fn()}
      {...props}
    />,
  );
}

describe("StudentRegistrationDialog", () => {
  it("초기값이 없으면 빈 폼과 피아노 선택 상태로 열린다", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "원생 등록" })).toBeVisible();
    expect(screen.getByLabelText("원생명")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "피아노 선택" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "바이올린 선택" })).not.toBeChecked();
  });

  it("나이로 학년과 학생 직업을 제안하고 사용자가 고른 학년은 덮어쓰지 않는다", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("나이"), "8");
    expect(screen.getByRole("combobox", { name: "학년" })).toHaveValue("초1");
    expect(screen.getByLabelText("직업")).toHaveValue("학생");

    await user.selectOptions(screen.getByRole("combobox", { name: "학년" }), "초2");
    await user.clear(screen.getByLabelText("나이"));
    await user.type(screen.getByLabelText("나이"), "9");
    expect(screen.getByRole("combobox", { name: "학년" })).toHaveValue("초2");
  });

  it("출생연도로 나이와 미취학 학년을 계산하고 한쪽을 지우면 둘 다 비운다", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("출생연도"), "2022");
    expect(screen.getByLabelText("나이")).toHaveValue("5");
    expect(screen.getByRole("combobox", { name: "학년" })).toHaveValue("유치원생(미취학아동)");

    await user.clear(screen.getByLabelText("나이"));
    expect(screen.getByLabelText("나이")).toHaveValue("");
    expect(screen.getByLabelText("출생연도")).toHaveValue("");
  });

  it("범위를 벗어난 나이와 완성되지 않은 출생연도는 그대로 보여 주고 가까이에서 안내한다", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("나이"), "999");
    expect(screen.getByLabelText("나이")).toHaveValue("999");
    expect(screen.getByRole("alert")).toHaveTextContent("1세부터 127세");

    await user.clear(screen.getByLabelText("나이"));
    await user.type(screen.getByLabelText("출생연도"), "20");
    expect(screen.getByLabelText("출생연도")).toHaveValue("20");
    expect(screen.getByRole("alert")).toHaveTextContent("4자리");
  });

  it("상담 내용을 초기값으로 받아 이름, 나이, 학교, 연락처, 악기를 채운다", () => {
    renderDialog({
      initialValues: {
        name: "김하늘",
        age: 9,
        school: "한빛초",
        phone: "010-3333-4444",
        instrumentNames: ["바이올린"],
      },
    });

    expect(screen.getByLabelText("원생명")).toHaveValue("김하늘");
    expect(screen.getByLabelText("나이")).toHaveValue("9");
    expect(screen.getByLabelText("출생연도")).toHaveValue("2018");
    expect(screen.getByLabelText("학교")).toHaveValue("한빛초");
    expect(screen.getByLabelText("연락처")).toHaveValue("010-3333-4444");
    expect(screen.getByRole("checkbox", { name: "바이올린 선택" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "피아노 선택" })).not.toBeChecked();
    expect(screen.getByRole("group", { name: /바이올린|수강 요일/ })).toBeTruthy();
  });

  it("목록에 없는 악기 이름은 무시하고 피아노로 시작한다", () => {
    renderDialog({ initialValues: { name: "이도윤", instrumentNames: ["드럼"] } });

    expect(screen.getByRole("checkbox", { name: "피아노 선택" })).toBeChecked();
  });

  it("초기값으로 채운 뒤 나머지를 입력하면 등록 입력을 제출한다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderDialog({
      onSubmit,
      initialValues: {
        name: "김하늘",
        age: 9,
        school: "한빛초",
        phone: "010-3333-4444",
        instrumentNames: ["바이올린"],
      },
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "바이올린 담당 선생님" }),
      "teacher-2",
    );
    await user.click(screen.getByRole("checkbox", { name: "바이올린 월요일" }));
    await user.click(screen.getByRole("button", { name: "등록" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "김하늘",
        age: 9,
        school: "한빛초",
        contact: expect.objectContaining({ phone: "010-3333-4444" }),
        instruments: [
          expect.objectContaining({
            instrumentName: "바이올린",
            teacherId: "teacher-2",
          }),
        ],
      }),
    );
  });

  it("두 번째 연락처는 구분과 번호를 모두 선택했을 때만 등록한다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog({ onSubmit, initialValues: {
      name: "김하늘", phone: "010-3333-4444", instrumentNames: ["바이올린"],
    } });

    await user.selectOptions(screen.getByRole("combobox", { name: "바이올린 담당 선생님" }), "teacher-2");
    await user.click(screen.getByRole("checkbox", { name: "바이올린 월요일" }));
    await user.type(screen.getByLabelText("두 번째 연락처 번호"), "010-5555-6666");
    expect(screen.getByText("두 번째 연락처 구분을 선택해 주세요.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "등록" }));
    expect(onSubmit).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByRole("combobox", { name: "두 번째 연락처 구분" }), "부");
    await user.click(screen.getByRole("button", { name: "등록" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      secondaryContact: { relationship: "부", phone: "010-5555-6666" },
    }));
  });

  it("등록 요청 중에는 버튼을 잠그고 중복 제출을 막으며 실패해도 입력을 유지한다", async () => {
    const user = userEvent.setup();
    let rejectSubmission: (reason?: unknown) => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<void>((_resolve, reject) => {
      rejectSubmission = reject;
    }));
    renderDialog({
      onSubmit,
      initialValues: {
        name: "김하늘",
        phone: "010-3333-4444",
        instrumentNames: ["바이올린"],
      },
    });

    await user.selectOptions(screen.getByLabelText("바이올린 담당 선생님"), "teacher-2");
    await user.click(screen.getByRole("checkbox", { name: "바이올린 월요일" }));
    await user.click(screen.getByRole("button", { name: "등록" }));

    const pendingButton = screen.getByRole("button", { name: "등록 중…" });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => rejectSubmission(new Error("일시 오류")));
    await waitFor(() => expect(screen.getByRole("button", { name: "등록" })).toBeEnabled());
    expect(screen.getByLabelText("원생명")).toHaveValue("김하늘");
  });

  describe("레슨비 가격표 자동 적용", () => {
    it("피아노 학원레슨은 요일별 가격을 제안하고 직접 수정한 금액은 보존한다", async () => {
      const user = userEvent.setup();
      renderDialog();
      const fee = screen.getByLabelText("피아노 레슨비");

      expect(screen.getByText("수강 요일을 선택하면 레슨비가 자동으로 계산됩니다.")).toBeVisible();
      await user.click(screen.getByRole("checkbox", { name: "피아노 월요일" }));
      await user.click(screen.getByRole("checkbox", { name: "피아노 수요일" }));
      expect(fee).toHaveValue("140000");

      await user.clear(fee);
      await user.type(fee, "145000");

      await user.click(screen.getByRole("checkbox", { name: "피아노 금요일" }));
      expect(fee).toHaveValue("145,000");
      expect(screen.getByLabelText("피아노 최종 수강료")).toHaveValue(145000);
    });

    it("진도를 바꾸면 같은 요일 개수에서도 가격표 금액으로 다시 계산한다", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("checkbox", { name: "피아노 월요일" }));
      await user.click(screen.getByRole("checkbox", { name: "피아노 수요일" }));
      await user.selectOptions(screen.getByLabelText("피아노 진도"), "작품반");

      expect(screen.getByLabelText("피아노 레슨비")).toHaveValue("180000");
    });

    it("진도는 수업 형태별 선택 목록이다", () => {
      renderDialog();

      expect(
        within(screen.getByLabelText("피아노 진도"))
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["바이엘", "체르니100", "체르니30", "체르니40", "작품반"]);
    });

    it("요일이 1개이거나 6개면 가격표 구간이 없으니 잘못된 금액을 넣지 않고 직접 입력하게 안내한다", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("checkbox", { name: "피아노 월요일" }));

      const fee = screen.getByLabelText("피아노 레슨비");
      expect(
        screen.getByText("요일 개수에 맞는 가격표가 없어 레슨비를 직접 입력해 주세요."),
      ).toBeVisible();
      expect(fee).toHaveValue("0");
      expect(fee).not.toHaveAttribute("readonly");
      await user.clear(fee);
      await user.type(fee, "135000");
      expect(screen.getByLabelText("피아노 최종 수강료")).toHaveValue(135000);
    });

    it("개인레슨 악기는 진도, 월 횟수, 수업 시간 선택으로 레슨비를 계산한다", async () => {
      const user = userEvent.setup();
      renderDialog({ initialValues: { instrumentNames: ["바이올린"] } });
      const fee = screen.getByLabelText("바이올린 레슨비");

      expect(fee).toHaveValue("140000");
      await user.selectOptions(screen.getByLabelText("바이올린 진도"), "스즈키 4~6권");
      await user.click(screen.getByRole("checkbox", { name: "바이올린 월요일" }));
      await user.click(screen.getByRole("checkbox", { name: "바이올린 화요일" }));
      expect(screen.getByLabelText("바이올린 월 횟수")).toHaveValue("월 8회");
      await user.selectOptions(screen.getByLabelText("바이올린 수업 시간"), "60");

      expect(fee).toHaveValue("440000");
    });

    it("개인레슨 시작 시간을 입력하면 회당 길이로 종료 시간을 계산한다", async () => {
      const user = userEvent.setup();
      renderDialog({ initialValues: { instrumentNames: ["바이올린"] } });

      await user.click(screen.getByRole("checkbox", { name: "바이올린 월요일" }));
      const startTime = screen.getByLabelText("바이올린 월 시작 시간");
      await user.type(startTime, "930");
      await user.tab();

      expect(startTime).toHaveValue("09:30");
      expect(screen.getByLabelText("바이올린 월 종료 시간")).toHaveValue("10:10");
    });

    it("피아노를 개인레슨으로 바꾸면 개인 레슨 가격표로 바뀐다", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.selectOptions(screen.getByLabelText("피아노 레슨 형태"), "private");

      expect(screen.getByLabelText("피아노 진도")).toHaveValue("피아노 개인 레슨");
      expect(screen.getByLabelText("피아노 레슨비")).toHaveValue("140000");
    });
  });

  describe("할인", () => {
    it("두 자녀·두 악기 할인은 매달 1만원씩 빼서 최종 수강료에 반영한다", async () => {
      const user = userEvent.setup();
      renderDialog({ initialValues: { instrumentNames: ["바이올린"] } });

      await user.click(screen.getByRole("checkbox", { name: "바이올린 두 자녀 할인" }));
      await user.click(screen.getByRole("checkbox", { name: "바이올린 두 악기 할인" }));

      expect(screen.getByLabelText("바이올린 최종 수강료")).toHaveValue(120000);
    });

    it("지인 소개 할인은 소개 달 선택을 보여 주고 매달 수강료에는 반영하지 않는다", async () => {
      const user = userEvent.setup();
      renderDialog({ initialValues: { instrumentNames: ["바이올린"] } });

      expect(screen.queryByLabelText("바이올린 지인 소개 할인 월")).not.toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: "바이올린 지인 소개 할인" }));

      expect(screen.getByLabelText("바이올린 지인 소개 할인 월")).toBeVisible();
      expect(screen.getByLabelText("바이올린 최종 수강료")).toHaveValue(140000);
    });

    it("선택한 할인과 소개 달을 등록 입력으로 제출한다", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderDialog({
        onSubmit,
        initialValues: { name: "김하늘", phone: "010-3333-4444", instrumentNames: ["바이올린"] },
      });

      await user.selectOptions(screen.getByLabelText("바이올린 담당 선생님"), "teacher-2");
      await user.click(screen.getByRole("checkbox", { name: "바이올린 월요일" }));
      await user.click(screen.getByRole("checkbox", { name: "바이올린 두 자녀 할인" }));
      await user.click(screen.getByRole("checkbox", { name: "바이올린 지인 소개 할인" }));
      await user.click(screen.getByRole("button", { name: "등록" }));

      const registrationMonth = (screen.getByLabelText("등록일") as HTMLInputElement).value.slice(0, 7);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          instruments: [
            expect.objectContaining({
              progress: "스즈키 1~3권",
              lessonFee: 140000,
              discountTotal: 10000,
              discountLabel: "두 자녀 할인, 지인 소개 할인",
              finalMonthlyFee: 130000,
              discountKinds: ["sibling", "referral"],
              referralDiscountMonth: registrationMonth,
              referralDiscountAmount: 10000,
            }),
          ],
        }),
      );
    });

    it("할인 직접 입력 항목과 형제할인 같은 이전 선택지는 더 이상 보이지 않는다", () => {
      renderDialog();

      expect(screen.queryByLabelText("피아노 할인 구분")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("피아노 할인액")).not.toBeInTheDocument();
    });
  });

  it("직접 입력이 필요한데 레슨비가 0원이면 등록을 막는다", async () => {
    const user = userEvent.setup();
    renderDialog({ initialValues: { name: "김하늘", phone: "010-3333-4444" } });

    await user.click(screen.getByRole("checkbox", { name: "피아노 월요일" }));
    await user.type(screen.getByLabelText("피아노 월 시작 시간"), "14:00");
    await user.type(screen.getByLabelText("피아노 월 종료 시간"), "14:50");
    expect(screen.getByRole("button", { name: "등록" })).toBeDisabled();

    await user.type(screen.getByLabelText("피아노 레슨비"), "135000");
    expect(screen.getByRole("button", { name: "등록" })).toBeEnabled();
  });

  it("수강 요일은 월~토만 고를 수 있다", () => {
    renderDialog();

    expect(screen.getByRole("checkbox", { name: "피아노 토요일" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "피아노 일요일" })).not.toBeInTheDocument();
  });

  describe("동명이인 안내", () => {
    it("같은 이름의 재원 원생이 있으면 구분해 쓰라는 안내를 보이지만 등록은 막지 않는다", async () => {
      const user = userEvent.setup();
      renderDialog({
        existingStudentNames: ["홍길동"],
        initialValues: { phone: "010-3333-4444", instrumentNames: ["바이올린"] },
      });

      expect(screen.queryByText(/같은 이름의 원생이 있습니다/)).not.toBeInTheDocument();
      await user.type(screen.getByLabelText("원생명"), "홍길동");
      await user.click(screen.getByRole("checkbox", { name: "바이올린 월요일" }));

      expect(
        screen.getByText("같은 이름의 원생이 있습니다. 홍길동a, 홍길동b처럼 구분해 주세요."),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "등록" })).toBeEnabled();
    });

    it("홍길동b처럼 이미 구분한 이름이면 안내하지 않는다", async () => {
      const user = userEvent.setup();
      renderDialog({ existingStudentNames: ["홍길동a"] });

      await user.type(screen.getByLabelText("원생명"), "홍길동b");

      expect(screen.queryByText(/같은 이름의 원생이 있습니다/)).not.toBeInTheDocument();
    });
  });
});
