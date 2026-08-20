import path from "path";
import { defineConfig } from "vitest/config";

// Tests puros de lógica (schemas Zod + heurísticos de permisos) — sin DOM,
// sin Next.js runtime. Solo necesitamos resolver el alias "@/*" que usa
// todo el código fuente (mismo mapeo que tsconfig.json).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
