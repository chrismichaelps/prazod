import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  dts: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  treeshake: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
