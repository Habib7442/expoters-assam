import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".agents", ".claude", "agent", ".next"],
  },
  resolve: {
    alias: {
      "@": rootDir,
      // "server-only" resolves via Next.js's webpack "react-server" build
      // condition, which Vitest doesn't apply; alias it to its own no-op
      // build so importing a server-only module doesn't throw outside Next.
      "server-only": path.join(rootDir, "node_modules/server-only/empty.js"),
    },
  },
});
