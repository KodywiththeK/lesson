"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { RegisterServiceWorker } from "@/features/pwa/register-service-worker";
import { DemoAcademyProvider } from "@/lib/demo/academy-demo-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DemoAcademyProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <RegisterServiceWorker enabled={process.env.NODE_ENV === "production"} />
      </DemoAcademyProvider>
    </QueryClientProvider>
  );
}
