import { describe, expect, it } from "vitest"

import { serializePostEvent } from "./post-event"

describe("serializePostEvent", () => {
  it("omits event data when a method has no parameters", () => {
    expect(serializePostEvent("web_app_ready")).toEqual({
      message: '{"eventType":"web_app_ready"}',
      serializedEventData: undefined,
    })
  })

  it("serializes method parameters for each transport shape", () => {
    expect(serializePostEvent("web_app_setup_back_button", { is_visible: true })).toEqual({
      message: '{"eventType":"web_app_setup_back_button","eventData":{"is_visible":true}}',
      serializedEventData: '{"is_visible":true}',
    })
  })
})
