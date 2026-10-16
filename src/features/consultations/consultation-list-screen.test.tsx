import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildConsultationList, type ConsultationListRow } from "@/domain/consultation-list";
import type { TeacherListRow } from "@/domain/teacher-list";
import { createConsultationListQueryKey } from "@/lib/api/consultations";

import {
  ConsultationListScreen,
  type ConsultationListQueryOptionsFactory,
} from "./consultation-list-screen";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const teachers: TeacherListRow[] = [
  {
    academyId: "academy-1",
    teacherId: "teacher-violin",
    name: "최선생",
    part: "바이올린",
    contact: "010-2222-2222",
    registeredAt: "2026-08-02",
    payType: "hourly",
  },
];

const consultationRows: ConsultationListRow[] = [
  {
    academyId: "academy-1",
    consultationId: "consultation-1",
    name: "김하늘",
    age: 9,
    instrumentNames: ["피아노"],
    phone: "010-1111-2222",
    school: "새봄초",
    memo: "화요일 오후 선호",
    // 한국 시간으로는 다음 날 00:30이다.
    receivedAt: "2026-10-12T15:30:00.000Z",
  },
  {
    academyId: "academy-1",
    consultationId: "consultation-2",
    name: "박서준",
    age: 11,
    instrumentNames: ["바이올린", "첼로"],
    phone: "010-3333-4444",
    school: "한빛초",
    memo: "체험 수업 희망",
    receivedAt: "2026-10-14T03:00:00.000Z",
  },
];

const manyConsultationRows: ConsultationListRow[] = Array.from({ length: 25 }, (_, index) => ({
  academyId: "academy-1",
  consultationId: `consultation-${String(index + 1).padStart(2, "0")}`,
  name: `상담${String(index + 1).padStart(2, "0")}`,
  instrumentNames: [],
  phone: "010-0000-0000",
  school: "",
  memo: "",
  receivedAt: `2026-09-${String(index + 1).padStart(2, "0")}T01:00:00.000Z`,
}));

function queryOptionsFor(rows: () => ConsultationListRow[]): ConsultationListQueryOptionsFactory {
  return (options) => ({
    queryKey: createConsultationListQueryKey(options),
    queryFn: async () => buildConsultationList(rows(), options),
  });
}

function renderScreen(props: Partial<ComponentProps<typeof ConsultationListScreen>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConsultationListScreen
        academyId="academy-1"
        queryOptionsFactory={queryOptionsFor(() => consultationRows)}
        teachers={teachers}
        {...props}
      />
    </QueryClientProvider>,
  );
}

function dataRows(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1);
}

describe("ConsultationListScreen", () => {
  beforeEach(() => {
    Object.values(toastMock).forEach((mock) => mock.mockReset());
  });

  describe("목록", () => {
    it("접수일 최신순으로 상담 내용을 표시하고 한국 시간 기준 접수일을 보여 준다", async () => {
      renderScreen();

      const table = await screen.findByRole("table", { name: "상담 목록" });
      const rows = dataRows(table);
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByRole("cell", { name: "박서준" })).toBeInTheDocument();
      expect(within(rows[0]).getByRole("cell", { name: "2026-10-14" })).toBeInTheDocument();
      expect(within(rows[0]).getByRole("cell", { name: "11세" })).toBeInTheDocument();
      expect(within(rows[0]).getByRole("cell", { name: "바이올린, 첼로" })).toBeInTheDocument();
      expect(within(rows[0]).getByRole("cell", { name: "010-3333-4444" })).toBeInTheDocument();
      expect(within(rows[0]).getByRole("cell", { name: "한빛초" })).toBeInTheDocument();
      expect(within(rows[0]).getByRole("cell", { name: "체험 수업 희망" })).toBeInTheDocument();
      expect(within(rows[1]).getByRole("cell", { name: "김하늘" })).toBeInTheDocument();
      expect(within(rows[1]).getByRole("cell", { name: "2026-10-13" })).toBeInTheDocument();
    });

    it("좁은 화면에서도 모든 항목명과 세 가지 행 작업을 제공한다", async () => {
      renderScreen();

      const table = await screen.findByRole("table", { name: "상담 목록" });
      const row = within(table).getByRole("row", { name: /김하늘/ });
      expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
        "접수일", "이름", "나이", "악기", "전화번호", "학교", "특이사항", "관리",
      ]);
      expect(within(row).getByRole("button", { name: "김하늘 원생 등록" })).toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "김하늘 수정" })).toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "김하늘 삭제" })).toBeInTheDocument();
    });

    it("나이·악기·학교·특이사항이 없으면 '-'로 표시한다", async () => {
      renderScreen({
        queryOptionsFactory: queryOptionsFor(() => [
          { ...consultationRows[0], age: undefined, instrumentNames: [], school: "", memo: "" },
        ]),
      });

      const row = await screen.findByRole("row", { name: /김하늘/ });
      expect(within(row).getAllByRole("cell", { name: "-" })).toHaveLength(4);
    });

    it("검색어와 악기 필터를 조회 조건으로 반영하고 초기화할 수 있다", async () => {
      const user = userEvent.setup();
      const seenOptions: Array<Parameters<ConsultationListQueryOptionsFactory>[0]> = [];
      renderScreen({
        queryOptionsFactory: (options) => {
          seenOptions.push(options);
          return queryOptionsFor(() => consultationRows)(options);
        },
      });
      await screen.findByRole("cell", { name: "박서준" });

      await user.type(screen.getByRole("searchbox", { name: "상담 검색" }), "체험");
      await user.selectOptions(screen.getByLabelText("악기 필터"), "바이올린");

      await waitFor(() => expect(screen.queryByRole("cell", { name: "김하늘" })).not.toBeInTheDocument());
      expect(screen.getByRole("cell", { name: "박서준" })).toBeInTheDocument();
      expect(seenOptions.at(-1)).toMatchObject({
        academyId: "academy-1",
        search: "체험",
        filters: { instrumentName: "바이올린" },
      });

      await user.click(screen.getByRole("button", { name: "초기화" }));

      expect(await screen.findByRole("cell", { name: "김하늘" })).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "상담 검색" })).toHaveValue("");
    });

    it("조건에 맞는 상담이 없으면 안내 문구를 보여 준다", async () => {
      renderScreen({ queryOptionsFactory: queryOptionsFor(() => []) });

      expect(await screen.findByText("조건에 맞는 상담 기록이 없습니다.")).toBeInTheDocument();
      expect(screen.getByText("총 0건")).toBeInTheDocument();
    });

    it("상담이 많아도 10건씩 보여 주고 총 건수와 페이지 이동을 제공한다", async () => {
      const user = userEvent.setup();
      renderScreen({ queryOptionsFactory: queryOptionsFor(() => manyConsultationRows) });

      const table = await screen.findByRole("table", { name: "상담 목록" });
      expect(dataRows(table)).toHaveLength(10);
      expect(screen.getByText("총 25건")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "페이지당 상담 수" })).toHaveValue("10");

      await user.click(screen.getByRole("button", { name: "3페이지" }));

      await waitFor(() => expect(dataRows(table)).toHaveLength(5));
    });

    it("조회에 실패하면 원인을 사용자 문구로 안내한다", async () => {
      renderScreen({
        queryOptionsFactory: (options) => ({
          queryKey: createConsultationListQueryKey(options),
          queryFn: async () => {
            throw new Error("permission denied");
          },
        }),
      });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("상담 목록을 불러오지 못했습니다.");
      expect(alert).toHaveTextContent("이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.");
      expect(alert).not.toHaveTextContent("permission denied");
    });
  });

  describe("상담 등록과 수정", () => {
    it("이름과 전화번호가 올바르지 않으면 저장할 수 없고 이유를 가까이에 알려 준다", async () => {
      const user = userEvent.setup();
      renderScreen({ registerConsultation: vi.fn() });

      await user.click(screen.getByRole("button", { name: "상담 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "상담 등록" });

      const saveButton = within(dialog).getByRole("button", { name: "저장" });
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveAccessibleDescription("이름을 입력해 주세요.");

      await user.type(within(dialog).getByLabelText("이름"), "정다은");
      expect(saveButton).toHaveAccessibleDescription("전화번호를 숫자 4자리 이상 입력해 주세요.");

      await user.type(within(dialog).getByLabelText("전화번호"), "010-5555-6666");
      expect(saveButton).toBeEnabled();
    });

    it("입력한 상담을 다듬어 저장하고 성공하면 닫고 안내한다", async () => {
      const user = userEvent.setup();
      const registerConsultation = vi.fn().mockResolvedValue(undefined);
      renderScreen({ registerConsultation });

      await user.click(screen.getByRole("button", { name: "상담 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "상담 등록" });
      expect(within(dialog).queryByLabelText("접수일")).not.toBeInTheDocument();
      await user.type(within(dialog).getByLabelText("이름"), " 정다은 ");
      await user.type(within(dialog).getByLabelText("나이"), "8");
      await user.type(within(dialog).getByLabelText("전화번호"), "010-5555-6666");
      await user.type(within(dialog).getByLabelText("학교"), "새봄초");
      await user.click(within(dialog).getByRole("checkbox", { name: "첼로 선택" }));
      await user.click(within(dialog).getByRole("checkbox", { name: "피아노 선택" }));
      await user.type(within(dialog).getByLabelText("특이사항"), "화요일 선호{Enter}체험 희망");
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(registerConsultation).toHaveBeenCalledWith({
          name: "정다은",
          age: 8,
          instrumentNames: ["피아노", "첼로"],
          phone: "010-5555-6666",
          school: "새봄초",
          memo: "화요일 선호\n체험 희망",
        }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "상담 등록" })).not.toBeInTheDocument(),
      );
      expect(toastMock.success).toHaveBeenCalledWith("상담을 등록했습니다.");
    });

    it("등록에 실패하면 입력을 남겨 둔 채 사용자 문구로 알린다", async () => {
      const user = userEvent.setup();
      renderScreen({ registerConsultation: vi.fn().mockRejectedValue(new Error("permission denied")) });

      await user.click(screen.getByRole("button", { name: "상담 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "상담 등록" });
      await user.type(within(dialog).getByLabelText("이름"), "정다은");
      await user.type(within(dialog).getByLabelText("전화번호"), "010-5555-6666");
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("상담 등록에 실패했습니다.", {
          description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
        }),
      );
      expect(screen.getByRole("dialog", { name: "상담 등록" })).toBeInTheDocument();
      expect(within(dialog).getByLabelText("이름")).toHaveValue("정다은");
    });

    it("수정 폼은 등록 폼의 모든 항목을 저장된 값으로 채우고 바꾼 내용을 모두 저장한다", async () => {
      const user = userEvent.setup();
      const updateConsultation = vi.fn().mockResolvedValue(undefined);
      renderScreen({ updateConsultation });

      await user.click(await screen.findByRole("button", { name: "김하늘 수정" }));
      const dialog = await screen.findByRole("dialog", { name: "상담 수정" });
      expect(within(dialog).getByLabelText("이름")).toHaveValue("김하늘");
      expect(within(dialog).getByLabelText("나이")).toHaveValue(9);
      expect(within(dialog).getByLabelText("전화번호")).toHaveValue("010-1111-2222");
      expect(within(dialog).getByLabelText("학교")).toHaveValue("새봄초");
      expect(within(dialog).getByRole("checkbox", { name: "피아노 선택" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "첼로 선택" })).not.toBeChecked();
      expect(within(dialog).getByLabelText("특이사항")).toHaveValue("화요일 오후 선호");

      await user.clear(within(dialog).getByLabelText("이름"));
      await user.type(within(dialog).getByLabelText("이름"), "김하늘이");
      await user.clear(within(dialog).getByLabelText("나이"));
      await user.clear(within(dialog).getByLabelText("전화번호"));
      await user.type(within(dialog).getByLabelText("전화번호"), "010-9999-0000");
      await user.clear(within(dialog).getByLabelText("학교"));
      await user.click(within(dialog).getByRole("checkbox", { name: "플루트 선택" }));
      await user.clear(within(dialog).getByLabelText("특이사항"));
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(updateConsultation).toHaveBeenCalledWith({
          consultationId: "consultation-1",
          name: "김하늘이",
          age: undefined,
          instrumentNames: ["피아노", "플루트"],
          phone: "010-9999-0000",
          school: "",
          memo: "",
        }),
      );
      expect(toastMock.success).toHaveBeenCalledWith("상담을 수정했습니다.");
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "상담 수정" })).not.toBeInTheDocument(),
      );
    });
  });

  describe("상담 삭제", () => {
    it("확인을 거쳐야 삭제하며 취소하면 아무것도 지우지 않는다", async () => {
      const user = userEvent.setup();
      const deleteConsultation = vi.fn().mockResolvedValue(undefined);
      renderScreen({ deleteConsultation });

      await user.click(await screen.findByRole("button", { name: "김하늘 삭제" }));
      const confirmation = await screen.findByRole("alertdialog", { name: "상담 기록을 삭제할까요?" });
      expect(confirmation).toHaveTextContent("김하늘");
      await user.click(within(confirmation).getByRole("button", { name: "취소" }));

      expect(deleteConsultation).not.toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("삭제를 확인하면 해당 상담만 지우고 안내한다", async () => {
      const user = userEvent.setup();
      const rows = [...consultationRows];
      const deleteConsultation = vi.fn(async ({ consultationId }: { consultationId: string }) => {
        rows.splice(rows.findIndex((row) => row.consultationId === consultationId), 1);
      });
      renderScreen({ queryOptionsFactory: queryOptionsFor(() => rows), deleteConsultation });

      await user.click(await screen.findByRole("button", { name: "김하늘 삭제" }));
      const confirmation = await screen.findByRole("alertdialog");
      await user.click(within(confirmation).getByRole("button", { name: "삭제" }));

      await waitFor(() =>
        expect(deleteConsultation).toHaveBeenCalledWith({ consultationId: "consultation-1" }),
      );
      await waitFor(() => expect(screen.queryByRole("cell", { name: "김하늘" })).not.toBeInTheDocument());
      expect(screen.getByRole("cell", { name: "박서준" })).toBeInTheDocument();
      expect(toastMock.success).toHaveBeenCalledWith("상담 기록을 삭제했습니다.");
    });

    it("삭제에 실패하면 사유를 알리고 상담을 그대로 둔다", async () => {
      const user = userEvent.setup();
      renderScreen({
        deleteConsultation: vi
          .fn()
          .mockRejectedValue(new Error("상담 기록을 삭제하지 못했습니다: 이미 삭제되었거나 삭제할 권한이 없습니다.")),
      });

      await user.click(await screen.findByRole("button", { name: "김하늘 삭제" }));
      const confirmation = await screen.findByRole("alertdialog");
      await user.click(within(confirmation).getByRole("button", { name: "삭제" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("상담 기록 삭제에 실패했습니다.", {
          description: "이미 삭제되었거나 삭제할 권한이 없습니다.",
        }),
      );
      // 확인 창이 열려 있어 배경은 접근성 트리에서 가려져 있다.
      expect(screen.getByRole("cell", { name: "김하늘", hidden: true })).toBeInTheDocument();
    });
  });

  describe("상담에서 원생 등록", () => {
    async function openEnrollmentDialog(
      user: ReturnType<typeof userEvent.setup>,
      props: Partial<ComponentProps<typeof ConsultationListScreen>>,
    ) {
      renderScreen(props);
      await user.click(await screen.findByRole("button", { name: "박서준 원생 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "원생 등록" });
      await user.click(within(dialog).getByRole("checkbox", { name: "바이올린 월요일" }));

      return dialog;
    }

    it("상담의 이름, 나이, 학교, 전화번호, 악기로 원생 등록 폼을 미리 채우고 나머지는 직접 입력하게 한다", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(await screen.findByRole("button", { name: "박서준 원생 등록" }));

      const dialog = await screen.findByRole("dialog", { name: "원생 등록" });
      expect(within(dialog).getByLabelText("원생명")).toHaveValue("박서준");
      expect(within(dialog).getByLabelText("나이")).toHaveValue(11);
      expect(within(dialog).getByLabelText("학교")).toHaveValue("한빛초");
      expect(within(dialog).getByLabelText("연락처")).toHaveValue("010-3333-4444");
      expect(within(dialog).getByRole("checkbox", { name: "바이올린 선택" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "첼로 선택" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "피아노 선택" })).not.toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "바이올린 월요일" })).not.toBeChecked();
    });

    it("원생 등록에 성공하면 해당 상담 기록을 자동으로 삭제하고 안내한다", async () => {
      const user = userEvent.setup();
      const rows = [...consultationRows];
      const registerStudent = vi.fn().mockResolvedValue(undefined);
      const deleteConsultation = vi.fn(async ({ consultationId }: { consultationId: string }) => {
        rows.splice(rows.findIndex((row) => row.consultationId === consultationId), 1);
      });
      const dialog = await openEnrollmentDialog(user, {
        queryOptionsFactory: queryOptionsFor(() => rows),
        registerStudent,
        deleteConsultation,
      });
      await user.click(within(dialog).getByRole("checkbox", { name: "첼로 선택" }));
      await user.selectOptions(
        within(dialog).getByRole("combobox", { name: "바이올린 담당 선생님" }),
        "teacher-violin",
      );
      await user.click(within(dialog).getByRole("button", { name: "등록" }));

      await waitFor(() =>
        expect(registerStudent).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "박서준",
            age: 11,
            school: "한빛초",
            contact: expect.objectContaining({ phone: "010-3333-4444" }),
          }),
        ),
      );
      await waitFor(() =>
        expect(deleteConsultation).toHaveBeenCalledWith({ consultationId: "consultation-2" }),
      );
      expect(registerStudent.mock.invocationCallOrder[0]).toBeLessThan(
        deleteConsultation.mock.invocationCallOrder[0],
      );
      expect(toastMock.success).toHaveBeenCalledWith("원생을 등록하고 상담 기록을 삭제했습니다.");
      await waitFor(() => expect(screen.queryByRole("cell", { name: "박서준" })).not.toBeInTheDocument());
      expect(screen.queryByRole("dialog", { name: "원생 등록" })).not.toBeInTheDocument();
    });

    it("원생 등록을 처리하는 동안 다시 눌러도 같은 원생을 두 번 등록하지 않는다", async () => {
      const user = userEvent.setup();
      let finishRegistration: () => void = () => undefined;
      const registerStudent = vi.fn(
        () => new Promise<void>((resolve) => (finishRegistration = resolve)),
      );
      const dialog = await openEnrollmentDialog(user, {
        registerStudent,
        deleteConsultation: vi.fn().mockResolvedValue(undefined),
      });
      await user.click(within(dialog).getByRole("checkbox", { name: "첼로 선택" }));
      await user.selectOptions(
        within(dialog).getByRole("combobox", { name: "바이올린 담당 선생님" }),
        "teacher-violin",
      );

      await user.click(within(dialog).getByRole("button", { name: "등록" }));
      await user.click(within(dialog).getByRole("button", { name: "등록" }));
      finishRegistration();

      await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1));
      expect(registerStudent).toHaveBeenCalledTimes(1);
    });

    it("원생 등록이 실패하면 상담 기록은 지우지 않고 폼을 열어 둔 채 사유를 알린다", async () => {
      const user = userEvent.setup();
      const deleteConsultation = vi.fn();
      const dialog = await openEnrollmentDialog(user, {
        registerStudent: vi.fn().mockRejectedValue(new Error("permission denied")),
        deleteConsultation,
      });
      await user.selectOptions(
        within(dialog).getByRole("combobox", { name: "바이올린 담당 선생님" }),
        "teacher-violin",
      );
      await user.click(within(dialog).getByRole("checkbox", { name: "첼로 선택" }));
      await user.click(within(dialog).getByRole("button", { name: "등록" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("원생 등록에 실패했습니다.", {
          description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
        }),
      );
      expect(deleteConsultation).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "원생 등록" })).toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "박서준", hidden: true })).toBeInTheDocument();
    });

    it("원생은 등록했지만 상담 삭제가 실패하면 상담 기록을 남기고 직접 삭제하도록 안내한다", async () => {
      const user = userEvent.setup();
      const registerStudent = vi.fn().mockResolvedValue(undefined);
      const dialog = await openEnrollmentDialog(user, {
        registerStudent,
        deleteConsultation: vi.fn().mockRejectedValue(new Error("permission denied")),
      });
      await user.selectOptions(
        within(dialog).getByRole("combobox", { name: "바이올린 담당 선생님" }),
        "teacher-violin",
      );
      await user.click(within(dialog).getByRole("checkbox", { name: "첼로 선택" }));
      await user.click(within(dialog).getByRole("button", { name: "등록" }));

      await waitFor(() =>
        expect(toastMock.warning).toHaveBeenCalledWith(
          "원생은 등록했지만 상담 기록을 삭제하지 못했습니다. 상담 목록에서 직접 삭제해 주세요.",
          { description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요." },
        ),
      );
      expect(registerStudent).toHaveBeenCalledTimes(1);
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog", { name: "원생 등록" })).not.toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "박서준" })).toBeInTheDocument();
    });
  });
});
