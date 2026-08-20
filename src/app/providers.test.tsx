import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "./providers";

function QueryClientProbe() {
  const queryClient = useQueryClient();

  return (
    <output aria-label="query-client-state">
      {queryClient instanceof QueryClient ? "ready" : "missing"}
    </output>
  );
}

describe("AppProviders", () => {
  it("하위 클라이언트 컴포넌트에 TanStack Query client를 제공한다", () => {
    render(
      <AppProviders>
        <QueryClientProbe />
      </AppProviders>,
    );

    expect(screen.getByLabelText("query-client-state")).toHaveTextContent(
      "ready",
    );
  });
});
