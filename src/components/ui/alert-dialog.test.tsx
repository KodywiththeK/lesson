import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./alert-dialog";

describe("AlertDialog", () => {
  it("일반 Dialog 위에 표시되도록 더 높은 레이어를 사용한다", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>상태 변경 확인</AlertDialogTitle>
          <AlertDialogDescription>처리 전 한 번 더 확인합니다.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(document.querySelector("[data-slot='alert-dialog-overlay']")).toHaveClass("z-[70]");
    expect(document.querySelector("[data-slot='alert-dialog-overlay']")).toHaveStyle({
      zIndex: "900",
    });
    expect(screen.getByRole("alertdialog")).toHaveClass("z-[80]");
    expect(screen.getByRole("alertdialog")).toHaveStyle({ zIndex: "1000" });
  });
});
