import { describe, expect, it } from "bun:test"

import { isDesktopPlatform } from "./platform"

describe("isDesktopPlatform", () => {
  it.each(["macos", "tdesktop", "unigram", "windows", "web", "weba", "webk"])(
    "treats %s as a desktop platform",
    (platform) => {
      expect(isDesktopPlatform(platform)).toBe(true)
    },
  )

  it.each(["android", "android_x", "ios", "unknown"])(
    "does not treat %s as a desktop platform",
    (platform) => {
      expect(isDesktopPlatform(platform)).toBe(false)
    },
  )
})
