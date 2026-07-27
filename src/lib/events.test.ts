import { describe, expect, it } from "vitest"

import { parseEventPayload } from "./events"

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
})
