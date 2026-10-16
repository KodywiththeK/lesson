import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

describe("반응형 표", () => {
  it("같은 데이터 행에 표 헤더와 카드용 항목명을 제공한다", () => {
    render(
      <Table aria-label="원생 목록">
        <TableHeader>
          <TableRow><TableHead>원생</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          <TableRow><TableCell label="원생">홍길동</TableCell></TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table", { name: "원생 목록" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "홍길동" })).toHaveAttribute("data-label", "원생");
    expect(screen.getByRole("table", { name: "원생 목록" }).parentElement).toHaveAttribute("data-responsive-table");
  });
});
