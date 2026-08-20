import path from "node:path";
import { defineConfig, defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "unit",
          include: ["src/domain/**/*.test.ts", "src/lib/**/*.test.ts"],
          environment: "node",
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
      }),
      defineProject({
        plugins: [react()],
        test: {
          name: "components",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["src/test/setup.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
      }),
    ],
  },
});
