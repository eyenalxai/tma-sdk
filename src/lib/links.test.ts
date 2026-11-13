import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createLinks } from "./links"

const readParams = (eventData: string | undefined): unknown => JSON.parse(eventData ?? "null")

describe("createLinks", () => {
  it("omits parameters the client version predates", () => {
    const environment = createTestRuntime("ios", "6.3")
    try {
      const links = createLinks(environment.runtime)
      expect(links.supported).toBe(true)
      expect(links.state.get()).toBeNull()

      links.actions.open("https://example.com", {
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
      createLinks(instantView.runtime).actions.open("https://example.com", {
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
      createLinks(browser.runtime).actions.open("https://example.com", {
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

  it("opens Telegram links through the protocol", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      createLinks(environment.runtime).actions.openTelegram("https://t.me/telegram/123?start=abc")

      expect(environment.posts).toEqual([
        {
          eventType: "web_app_open_tg_link",
          eventData: '{"path_full":"/telegram/123?start=abc"}',
        },
      ])
    } finally {
      environment.dispose()
    }
  })

  it("rejects a link that is not a Telegram hostname", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const links = createLinks(environment.runtime)

      expect(() => {
        links.actions.openTelegram("https://example.com")
      }).toThrow("hostname")
      expect(environment.posts).toEqual([])
    } finally {
      environment.dispose()
    }
  })
})
