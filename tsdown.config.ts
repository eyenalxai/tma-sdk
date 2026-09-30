import { defineConfig } from "tsdown"

// The bundler strips per-module directives, so the built React entry re-declares it.
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
  deps: {
    neverBundle: true,
  },
  attw: {
    enabled: "ci-only",
    profile: "esm-only",
    level: "error",
  },
  publint: "ci-only",
})
