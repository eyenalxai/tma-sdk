import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createOpenLink } from "./links"

const readParams = (eventData: string | undefined): unknown => JSON.parse(eventData ?? "null")

describe("createOpenLink", () => {
  it("omits parameters the client version predates", () => {
    const environment = createTestRuntime("ios", "6.3")
    try {
      createOpenLink(environment.runtime)("https://example.com", {
        tryBrowser: "safari",
        tryInstantView: true,
      })

      expect(readParams(environment.posts[0]?.eventData)).toEqual({
        url: "https://example.com/",
      })
    } finally {
      environment.dispose()
    }
  })

  it("sends try_instant_view from 6.4 and try_browser from 7.6", () => {
    const instantView = createTestRuntime("ios", "6.4")
    try {
      createOpenLink(instantView.runtime)("https://example.com", {
        tryBrowser: "safari",
        tryInstantView: true,
      })

      expect(readParams(instantView.posts[0]?.eventData)).toEqual({
        url: "https://example.com/",
        try_instant_view: true,
      })
    } finally {
      instantView.dispose()
    }

    const browser = createTestRuntime("ios", "7.6")
    try {
      createOpenLink(browser.runtime)("https://example.com", {
        tryBrowser: "safari",
        tryInstantView: true,
      })

      expect(readParams(browser.posts[0]?.eventData)).toEqual({
        url: "https://example.com/",
        try_browser: "safari",
        try_instant_view: true,
      })
    } finally {
      browser.dispose()
    }
  })
})
