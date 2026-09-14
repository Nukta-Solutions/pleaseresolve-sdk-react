import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "browser",
  // Never bundle react or the core SDK — a customer's own app already has
  // (or peer-installs) both; bundling them in would risk two React copies
  // or two SDK singletons (the core keeps its widget state in a module-level
  // variable — two copies means two independent, desynced widgets).
  external: ["react", "react/jsx-runtime", "@pleaseresolve/sdk"],
});
