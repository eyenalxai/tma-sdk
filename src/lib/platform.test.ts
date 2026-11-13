import { describe, expect, it } from "bun:test"

import type { PlatformKind } from "./platform"

import { getPlatform } from "./platform"

type PlatformCase = readonly [
  name: string,
  kind: PlatformKind,
  supportsViewport: boolean,
  isEmbeddedWeb: boolean,
]

const platformCases: readonly PlatformCase[] = [
  ["ios", "mobile", true, false],
  ["android", "mobile", true, false],
  ["android_x", "mobile", true, false],
  ["macos", "desktop", false, false],
  ["tdesktop", "desktop", true, false],
  ["unigram", "desktop", false, false],
  ["windows", "desktop", false, false],
  ["web", "web", false, true],
  ["weba", "web", false, true],
  ["webk", "web", false, true],
  ["unknown", "unknown", false, false],
]

describe("getPlatform", () => {
  it.each(platformCases)(
    "maps %s to its capabilities",
    (name, kind, supportsViewport, isEmbeddedWeb) => {
      expect(getPlatform(name)).toEqual({ name, kind, supportsViewport, isEmbeddedWeb })
    },
  )

  it("keeps the raw name for a platform the table does not observe", () => {
    expect(getPlatform("blackberry")).toEqual({
      name: "blackberry",
      kind: "unknown",
      supportsViewport: false,
      isEmbeddedWeb: false,
    })
  })
})
