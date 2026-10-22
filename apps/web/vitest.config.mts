import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest for apps/web. Two projects, deliberately separated:
 *
 *   * `web`         — everything under src/ plus the migration text assertions
 *                     that sit beside the SQL they read, run in the Node
 *                     environment. No jsdom: nothing here renders a component.
 *   * `mobile-view` — the Node-side assertions about
 *                     apps/mobile/src/lib/roadmap-view.ts, which is a pure
 *                     module imported by relative path. Its `include` covers
 *                     only `roadmap-view*.test.ts` and the project carries no
 *                     alias and no transform, so the day someone adds a
 *                     `react-native` import to that module the failure is an
 *                     immediate load error in this project rather than a
 *                     mysterious transform error somewhere else.
 *                     (The test file itself arrives with task 5.)
 *
 * Benchmarks live in bench/ and are matched only by `benchmark.include`, so
 * `vitest run` never picks them up — `pnpm bench` runs them, and they never
 * gate the suite.
 */
const srcAlias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

const IGNORED = ["**/node_modules/**", "**/.next/**", "**/dist/**"];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: srcAlias },
        test: {
          name: "web",
          environment: "node",
          include: ["src/**/*.test.ts", "supabase/**/*.test.ts"],
          exclude: [...IGNORED, "src/**/roadmap-view*.test.ts"],
          benchmark: {
            include: ["bench/**/*.bench.ts"],
            exclude: IGNORED,
          },
        },
      },
      {
        test: {
          name: "mobile-view",
          environment: "node",
          include: ["src/**/roadmap-view*.test.ts"],
          exclude: IGNORED,
          // This project owns one module; benchmarks belong to the web project.
          benchmark: { include: ["src/**/roadmap-view*.bench.ts"], exclude: IGNORED },
        },
      },
    ],
  },
});
