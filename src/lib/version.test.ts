import { describe, expect, it } from "vitest"

import { compareVersions, supports, supportsParam } from "./version"

describe("compareVersions", () => {
  it("compares versions segment by segment", () => {
    expect(compareVersions("8.0", "7.10")).toBeGreaterThan(0)
    expect(compareVersions("7.10", "8.0")).toBeLessThan(0)
    expect(compareVersions("8", "8.0.0")).toBe(0)
  })
})

describe("supports", () => {
  it("checks method and parameter versions", () => {
    expect(supports("web_app_request_fullscreen", "7.10")).toBe(false)
    expect(supports("web_app_request_fullscreen", "8.0")).toBe(true)
    expect(supportsParam("web_app_open_link.try_instant_view", "6.3")).toBe(false)
    expect(supportsParam("web_app_open_link.try_instant_view", "6.4")).toBe(true)
  })
})
