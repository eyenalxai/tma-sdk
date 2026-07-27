import { describe, expect, it } from "vitest"

import { hasStableViewport, shouldRequestContentSafeArea } from "./viewport"

describe("hasStableViewport", () => {
  it.each(["macos", "tdesktop", "unigram", "web", "weba", "webk"])(
    "treats %s as stable",
    (platform) => {
      expect(hasStableViewport(platform)).toBe(true)
    },
  )

  it.each(["android", "android_x", "ios", "unknown"])(
    "requests viewport data on %s",
    (platform) => {
      expect(hasStableViewport(platform)).toBe(false)
    },
  )
})

describe("shouldRequestContentSafeArea", () => {
  it("does not request content-safe-area state on macOS", () => {
    expect(shouldRequestContentSafeArea("macos", "9.6")).toBe(false)
  })

  it("requests supported content-safe-area state on other platforms", () => {
    expect(shouldRequestContentSafeArea("ios", "9.6")).toBe(true)
  })

  it("does not request unsupported content-safe-area state", () => {
    expect(shouldRequestContentSafeArea("ios", "7.10")).toBe(false)
  })
})
