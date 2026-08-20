import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buildVendorList } from "@/domain/vendor-list";

import {
  VendorListScreen,
  type VendorListQueryOptionsFactory,
} from "./vendor-list-screen";

const vendorRows = [
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

function renderVendorListScreen(
  queryOptionsFactory: VendorListQueryOptionsFactory,
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
      />
    </QueryClientProvider>,
  );
}

describe("VendorListScreen", () => {
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
    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
  });
});
