import { defineConfig } from "tsdown"

const reactClientDirective = ({ fileName }: { fileName: string }) =>
  fileName === "react.js" ? { js: '"use client"' } : undefined

export default defineConfig({
  entry: ["src/index.ts", "src/react.ts", "src/server.ts"],
  format: ["esm"],
  target: "es2023",
  platform: "neutral",
  dts: true,
  sourcemap: false,
  minify: false,
  clean: true,
  banner: reactClientDirective,
  alias: {
    // Mirrors the tsconfig path alias so internal absolute imports are bundled.
    "@eyenalxai/tma-sdk": "./src",
  },
  deps: {
    neverBundle: true,
    // The package's own tsconfig path alias (`@eyenalxai/tma-sdk/*` -> `./src/*`)
    // must be inlined; everything else stays external.
    alwaysBundle: [/^@eyenalxai\/tma-sdk\//],
  },
  attw: {
    enabled: "ci-only",
    profile: "esm-only",
    level: "error",
  },
  publint: "ci-only",
})
