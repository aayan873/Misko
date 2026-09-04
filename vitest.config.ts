import { defineConfig } from "vitest/config";
import path from "path";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping. Without this,
// Vitest's own module resolution (it doesn't read tsconfig paths on its own)
// fails to resolve the "@/..." imports used throughout src/app/api/*/route.ts
// — meaning no test file could import and exercise an actual route handler,
// only the underlying lib functions. Deliberately a plain resolve.alias
// rather than pulling in a vite-tsconfig-paths dependency for one mapping.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
