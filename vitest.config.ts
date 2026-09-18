import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["proof/test/**/*.test.ts"],
    environment: "node",
    reporters: "default",
  },
});
