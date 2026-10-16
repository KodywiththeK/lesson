import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildVendorList, type VendorListRow } from "@/domain/vendor-list";
import { queryKeys } from "@/lib/api/query-keys";

import {
  VendorListScreen,
  type VendorListQueryOptionsFactory,
} from "./vendor-list-screen";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const vendorRows: VendorListRow[] = [
  {
    academyId: "academy-1",
    vendorId: "vendor-1",
    name: "예음문구",
    contact: "02-111-1111",
    kind: "교재",
    memo: "바이엘 재고 확인",
  },
  {
    academyId: "academy-1",
    vendorId: "vendor-2",
    name: "스튜디오조율",
    contact: "02-222-2222",
    kind: "피아노 조율",
    memo: "분기 조율",
  },
];

const manyVendorRows: VendorListRow[] = Array.from({ length: 25 }, (_, index) => ({
  academyId: "academy-1",
  vendorId: `vendor-${String(index + 1).padStart(2, "0")}`,
  name: `거래처${String(index + 1).padStart(2, "0")}`,
  contact: "02-000-0000",
  kind: index % 2 === 0 ? "교재" : "피아노 조율",
  memo: "",
}));

function pagedVendorQueryOptions(
  rows: () => VendorListRow[],
): VendorListQueryOptionsFactory {
  return (options) => ({
    queryKey: queryKeys.vendors.list(options.academyId, {
      q: options.search,
      kind: options.filters?.kind,
      page: options.page?.toString(),
      pageSize: options.pageSize?.toString(),
    }),
    queryFn: async () => buildVendorList(rows(), options),
  });
}

function renderVendorListScreen(
  queryOptionsFactory: VendorListQueryOptionsFactory,
  props: Partial<ComponentProps<typeof VendorListScreen>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <VendorListScreen
        academyId="academy-1"
        academyName="더 클래식"
        queryOptionsFactory={queryOptionsFactory}
        {...props}
      />
    </QueryClientProvider>,
  );
}

function dataRows(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1);
}

describe("VendorListScreen", () => {
  beforeEach(() => {
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  it("좁은 화면에서도 거래처 정보와 수정 작업의 항목명을 제공한다", async () => {
    renderVendorListScreen((options) => ({
      queryKey: ["vendors", options.academyId],
      queryFn: async () => buildVendorList(vendorRows, options),
    }));

    const table = await screen.findByRole("table", { name: "거래처 목록" });
    const row = within(table).getByRole("row", { name: /예음문구/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
      "거래처", "연락처", "종류", "비고", "관리",
    ]);
  });

  it("거래처 목록을 표로 보여주고 연락처, 종류, 비고를 표시한다", async () => {
    renderVendorListScreen((options) => ({
      queryKey: ["vendors", options.academyId, options.search ?? ""],
      queryFn: async () => buildVendorList(vendorRows, options),
    }));

    const table = await screen.findByRole("table", { name: "거래처 목록" });
    expect(
      within(table).getByRole("cell", { name: "예음문구" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "02-111-1111" }),
    ).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "교재" })).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "바이엘 재고 확인" }),
    ).toBeInTheDocument();
  });

  it("검색어와 종류 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<VendorListQueryOptionsFactory>[0][] = [];

    renderVendorListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "vendors",
          options.academyId,
          options.search ?? "",
          options.filters?.kind ?? "",
        ],
        queryFn: async () => buildVendorList(vendorRows, options),
      };
    });

    await screen.findByRole("cell", { name: "예음문구" });

    await user.type(
      screen.getByRole("searchbox", { name: "거래처 검색" }),
      "분기",
    );
    await user.selectOptions(
      screen.getByLabelText("거래처 종류 필터"),
      "피아노 조율",
    );

    expect(
      await screen.findByRole("cell", { name: "스튜디오조율" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "예음문구" }),
    ).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "분기",
      filters: {
        kind: "피아노 조율",
      },
    });
  });

  it("Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다", async () => {
    renderVendorListScreen((options) => ({
      queryKey: ["vendors", options.academyId, "error"],
      queryFn: async () => {
        throw new Error("permission denied");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "거래처 목록을 불러오지 못했습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("permission denied");
  });

  describe("페이지 이동", () => {
    it("거래처가 많아도 첫 10곳만 보여주고 총 건수와 페이지 이동을 항상 제공한다", async () => {
      const user = userEvent.setup();
      renderVendorListScreen(pagedVendorQueryOptions(() => manyVendorRows));

      const table = await screen.findByRole("table", { name: "거래처 목록" });
      expect(dataRows(table)).toHaveLength(10);
      expect(
        within(table).getByRole("cell", { name: "거래처10" }),
      ).toBeInTheDocument();
      expect(
        within(table).queryByRole("cell", { name: "거래처11" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("총 25곳")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "2페이지" }));

      expect(
        await within(table).findByRole("cell", { name: "거래처11" }),
      ).toBeInTheDocument();
      expect(dataRows(table)).toHaveLength(10);

      await user.click(screen.getByRole("button", { name: "다음 페이지" }));

      expect(
        await within(table).findByRole("cell", { name: "거래처25" }),
      ).toBeInTheDocument();
      expect(dataRows(table)).toHaveLength(5);
    });

    it("거래처가 한 페이지 분량이어도 총 건수와 페이지당 개수 선택을 보여준다", async () => {
      renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows));

      await screen.findByRole("cell", { name: "예음문구" });

      expect(screen.getByText("총 2곳")).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: "페이지당 거래처 수" }),
      ).toHaveValue("10");
    });

    it("페이지당 개수를 바꾸면 1페이지부터 그 수만큼 보여준다", async () => {
      const user = userEvent.setup();
      renderVendorListScreen(pagedVendorQueryOptions(() => manyVendorRows));

      const table = await screen.findByRole("table", { name: "거래처 목록" });
      await user.click(screen.getByRole("button", { name: "3페이지" }));
      await within(table).findByRole("cell", { name: "거래처21" });

      await user.selectOptions(
        screen.getByRole("combobox", { name: "페이지당 거래처 수" }),
        "20곳",
      );

      await waitFor(() => expect(dataRows(table)).toHaveLength(20));
      expect(
        within(table).getByRole("cell", { name: "거래처01" }),
      ).toBeInTheDocument();
    });

    it("검색어를 바꾸면 1페이지부터 다시 보여준다", async () => {
      const user = userEvent.setup();
      const seenOptions: Parameters<VendorListQueryOptionsFactory>[0][] = [];
      const factory = pagedVendorQueryOptions(() => manyVendorRows);
      renderVendorListScreen((options) => {
        seenOptions.push(options);

        return factory(options);
      });

      const table = await screen.findByRole("table", { name: "거래처 목록" });
      await user.click(screen.getByRole("button", { name: "2페이지" }));
      await within(table).findByRole("cell", { name: "거래처11" });

      await user.type(
        screen.getByRole("searchbox", { name: "거래처 검색" }),
        "거래처1",
      );

      await waitFor(() => expect(seenOptions.at(-1)?.search).toBe("거래처1"));
      expect(seenOptions.at(-1)?.page).toBe(1);
    });

    it("종류 필터를 바꾸면 1페이지부터 다시 보여준다", async () => {
      const user = userEvent.setup();
      const seenOptions: Parameters<VendorListQueryOptionsFactory>[0][] = [];
      const factory = pagedVendorQueryOptions(() => manyVendorRows);
      renderVendorListScreen((options) => {
        seenOptions.push(options);

        return factory(options);
      });

      const table = await screen.findByRole("table", { name: "거래처 목록" });
      await user.click(screen.getByRole("button", { name: "2페이지" }));
      await within(table).findByRole("cell", { name: "거래처11" });

      await user.selectOptions(
        screen.getByLabelText("거래처 종류 필터"),
        "피아노 조율",
      );

      await waitFor(() =>
        expect(seenOptions.at(-1)?.filters?.kind).toBe("피아노 조율"),
      );
      expect(seenOptions.at(-1)?.page).toBe(1);
    });

    it("초기화를 누르면 검색과 필터를 지우고 1페이지로 돌아간다", async () => {
      const user = userEvent.setup();
      renderVendorListScreen(pagedVendorQueryOptions(() => manyVendorRows));

      const table = await screen.findByRole("table", { name: "거래처 목록" });
      await user.selectOptions(
        screen.getByLabelText("거래처 종류 필터"),
        "교재",
      );
      await user.click(await screen.findByRole("button", { name: "2페이지" }));
      await within(table).findByRole("cell", { name: "거래처21" });

      await user.click(screen.getByRole("button", { name: "초기화" }));

      expect(
        await within(table).findByRole("cell", { name: "거래처01" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("거래처 종류 필터")).toHaveValue("");
      expect(screen.getByText("총 25곳")).toBeInTheDocument();
    });
  });

  it("종류 필터를 골라도 선택지는 전체 거래처의 종류를 계속 보여준다", async () => {
    const user = userEvent.setup();
    renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows));

    await screen.findByRole("cell", { name: "예음문구" });
    await user.selectOptions(
      screen.getByLabelText("거래처 종류 필터"),
      "피아노 조율",
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("cell", { name: "예음문구" }),
      ).not.toBeInTheDocument(),
    );

    const filter = screen.getByLabelText("거래처 종류 필터");
    expect(
      within(filter).getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["전체", "교재", "피아노 조율"]);
  });

  describe("거래처 등록", () => {
    it("등록 폼에는 API로 저장되지 않는 등록일 입력이 없고, 앞뒤 공백을 지운 값만 전달한다", async () => {
      const user = userEvent.setup();
      const registerVendor = vi.fn();
      renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows), {
        registerVendor,
      });

      await user.click(await screen.findByRole("button", { name: "거래처 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "거래처 등록" });

      expect(within(dialog).queryByText("등록일")).not.toBeInTheDocument();

      await user.type(within(dialog).getByLabelText("거래처명"), "  현악기 공방 ");
      await user.type(within(dialog).getByLabelText("종류"), " 수리 ");
      await user.type(within(dialog).getByLabelText("연락처"), "02-7777-8888");
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(registerVendor).toHaveBeenCalledWith({
          name: "현악기 공방",
          contact: "02-7777-8888",
          kind: "수리",
          memo: "",
        }),
      );
      await waitFor(() =>
        expect(toastMock.success).toHaveBeenCalledWith("거래처를 등록했습니다."),
      );
    });

    it("거래처명과 종류가 비어 있으면 저장할 수 없고 필수 입력임을 알려 준다", async () => {
      const user = userEvent.setup();
      renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows));

      await user.click(await screen.findByRole("button", { name: "거래처 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "거래처 등록" });

      expect(within(dialog).getByText("거래처명 (필수)")).toBeInTheDocument();
      expect(within(dialog).getByText("종류 (필수)")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();

      await user.type(within(dialog).getByLabelText("거래처명"), "현악기 공방");
      expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();

      await user.type(within(dialog).getByLabelText("종류"), "수리");
      expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();
    });

    it("저장하는 동안에는 저장 버튼을 막아 같은 거래처가 두 번 등록되지 않게 한다", async () => {
      const user = userEvent.setup();
      const registerVendor = vi.fn(() => new Promise<void>(() => {}));
      renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows), {
        registerVendor,
      });

      await user.click(await screen.findByRole("button", { name: "거래처 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "거래처 등록" });
      await user.type(within(dialog).getByLabelText("거래처명"), "현악기 공방");
      await user.type(within(dialog).getByLabelText("종류"), "수리");
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled(),
      );
      expect(registerVendor).toHaveBeenCalledTimes(1);
    });

    it("등록에 실패하면 사용자가 이해할 수 있는 문구로 알린다", async () => {
      const user = userEvent.setup();
      renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows), {
        registerVendor: async () => {
          throw new Error("permission denied");
        },
      });

      await user.click(await screen.findByRole("button", { name: "거래처 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "거래처 등록" });
      await user.type(within(dialog).getByLabelText("거래처명"), "현악기 공방");
      await user.type(within(dialog).getByLabelText("종류"), "수리");
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith(
          "거래처 등록에 실패했습니다.",
          { description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요." },
        ),
      );
    });
  });

  describe("거래처 수정", () => {
    it("행의 수정 버튼으로 현재 정보가 채워진 수정 다이얼로그를 연다", async () => {
      const user = userEvent.setup();
      renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows));

      await user.click(
        await screen.findByRole("button", { name: "예음문구 수정" }),
      );

      const dialog = await screen.findByRole("dialog", { name: "거래처 수정" });
      expect(within(dialog).getByLabelText("거래처명")).toHaveValue("예음문구");
      expect(within(dialog).getByLabelText("연락처")).toHaveValue("02-111-1111");
      expect(within(dialog).getByLabelText("종류")).toHaveValue("교재");
      expect(within(dialog).getByLabelText("비고")).toHaveValue(
        "바이엘 재고 확인",
      );
      expect(within(dialog).queryByText("등록일")).not.toBeInTheDocument();
    });

    it("수정한 값을 저장하면 다이얼로그를 닫고 목록을 다시 불러와 반영한다", async () => {
      const user = userEvent.setup();
      let rows = [...vendorRows];
      const updateVendor = vi.fn(
        async (input: {
          vendorId: string;
          name: string;
          contact: string;
          kind: string;
          memo: string;
        }) => {
          rows = rows.map((row) =>
            row.vendorId === input.vendorId ? { ...row, ...input } : row,
          );
        },
      );
      renderVendorListScreen(pagedVendorQueryOptions(() => rows), {
        updateVendor,
      });

      await user.click(
        await screen.findByRole("button", { name: "예음문구 수정" }),
      );
      const dialog = await screen.findByRole("dialog", { name: "거래처 수정" });
      const nameInput = within(dialog).getByLabelText("거래처명");
      await user.clear(nameInput);
      await user.type(nameInput, " 예음악기 ");
      await user.clear(within(dialog).getByLabelText("비고"));
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(updateVendor).toHaveBeenCalledWith({
          vendorId: "vendor-1",
          name: "예음악기",
          contact: "02-111-1111",
          kind: "교재",
          memo: "",
        }),
      );
      expect(await screen.findByRole("cell", { name: "예음악기" })).toBeInTheDocument();
      expect(
        screen.queryByRole("dialog", { name: "거래처 수정" }),
      ).not.toBeInTheDocument();
      expect(toastMock.success).toHaveBeenCalledWith("거래처를 수정했습니다.");
    });

    it("수정에도 거래처명과 종류는 필수라서 비우면 저장할 수 없다", async () => {
      const user = userEvent.setup();
      renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows));

      await user.click(
        await screen.findByRole("button", { name: "예음문구 수정" }),
      );
      const dialog = await screen.findByRole("dialog", { name: "거래처 수정" });
      const saveButton = within(dialog).getByRole("button", { name: "저장" });
      expect(saveButton).toBeEnabled();

      await user.clear(within(dialog).getByLabelText("거래처명"));
      expect(saveButton).toBeDisabled();

      await user.type(within(dialog).getByLabelText("거래처명"), "예음문구");
      await user.clear(within(dialog).getByLabelText("종류"));
      expect(saveButton).toBeDisabled();
    });

    it("수정에 실패하면 다이얼로그를 유지하고 사용자 문구로 알린다", async () => {
      const user = userEvent.setup();
      renderVendorListScreen(pagedVendorQueryOptions(() => vendorRows), {
        updateVendor: async () => {
          throw new Error("permission denied");
        },
      });

      await user.click(
        await screen.findByRole("button", { name: "예음문구 수정" }),
      );
      const dialog = await screen.findByRole("dialog", { name: "거래처 수정" });
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith(
          "거래처 수정에 실패했습니다.",
          { description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요." },
        ),
      );
      expect(
        screen.getByRole("dialog", { name: "거래처 수정" }),
      ).toBeInTheDocument();
    });
  });
});
