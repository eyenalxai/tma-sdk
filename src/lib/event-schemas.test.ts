import { describe, expect, it } from "bun:test"

import { parseEventPayload } from "./event-schemas"

describe("parseEventPayload", () => {
  it("accepts a null back-button payload", () => {
    expect(parseEventPayload("back_button_pressed", null)).toBeNull()
  })

  it("accepts an omitted back-button payload", () => {
    expect(parseEventPayload("back_button_pressed")).toBeNull()
  })

  it("reuses payloadless parsing for reload events", () => {
    expect(parseEventPayload("reload_iframe", null)).toBeNull()
    expect(parseEventPayload("reload_iframe")).toBeNull()
  })

  it("rejects an invalid payloadless event payload", () => {
    expect(() => parseEventPayload("back_button_pressed", {})).toThrow()
  })

  it("parses a structured event payload", () => {
    expect(
      parseEventPayload("content_safe_area_changed", {
        top: 12,
        bottom: 24,
        left: 0,
        right: 0,
      }),
    ).toEqual({ top: 12, bottom: 24, left: 0, right: 0 })
  })

  it("parses a JSON-encoded event payload", () => {
    expect(parseEventPayload("file_download_requested", '{"status":"downloading"}')).toEqual({
      status: "downloading",
    })
  })

  it("parses a viewport change event", () => {
    expect(
      parseEventPayload("viewport_changed", {
        height: 640,
        is_state_stable: true,
        is_expanded: false,
      }),
    ).toEqual({ height: 640, is_state_stable: true, is_expanded: false })
  })

  it("falls back to window dimensions for a null viewport payload", () => {
    // MacOS Telegram answers viewport requests with a null payload.
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { innerHeight: 480, innerWidth: 320 },
    })

    try {
      expect(parseEventPayload("viewport_changed", null)).toEqual({
        height: 480,
        width: 320,
        is_state_stable: true,
        is_expanded: true,
      })
    } finally {
      Reflect.deleteProperty(globalThis, "window")
    }
  })
})
