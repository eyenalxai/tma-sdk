import { describe, expect, it } from "bun:test"

import { isRecord } from "#lib/is-record"
import { createTestRuntime } from "#lib/protocol/test-support"

import { createClipboard } from "./clipboard"

const readRequestId = (eventData: string | undefined): string => {
  const parsed: unknown = JSON.parse(eventData ?? "null")
  return isRecord(parsed) && typeof parsed.req_id === "string" ? parsed.req_id : ""
}

describe("createClipboard", () => {
  it("reads the correlated text and stores it", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const clipboard = createClipboard(environment.runtime)
      expect(clipboard.supported).toBe(true)
      expect(clipboard.state.get().text).toBeNull()

      const read = clipboard.actions.read()
      const requestId = readRequestId(environment.posts[0]?.eventData)
      expect(environment.posts[0]?.eventType).toBe("web_app_read_text_from_clipboard")
      expect(requestId.length).toBeGreaterThan(0)

      environment.emit("clipboard_text_received", { req_id: requestId, data: "hello" })

      expect(await read).toBe("hello")
      expect(clipboard.state.get().text).toBe("hello")
    } finally {
      environment.dispose()
    }
  })

  it("returns null when the host sends no text", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const clipboard = createClipboard(environment.runtime)

      const read = clipboard.actions.read()
      const requestId = readRequestId(environment.posts[0]?.eventData)
      environment.emit("clipboard_text_received", { req_id: requestId })

      expect(await read).toBeNull()
      expect(clipboard.state.get().text).toBeNull()
    } finally {
      environment.dispose()
    }
  })

  it("uses a fresh request id for every read", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const clipboard = createClipboard(environment.runtime)

      const first = clipboard.actions.read()
      const firstId = readRequestId(environment.posts[0]?.eventData)
      environment.emit("clipboard_text_received", { req_id: firstId, data: "one" })
      await first

      const second = clipboard.actions.read()
      const secondId = readRequestId(environment.posts[1]?.eventData)
      expect(secondId).not.toBe(firstId)

      environment.emit("clipboard_text_received", { req_id: secondId, data: "two" })
      expect(await second).toBe("two")
    } finally {
      environment.dispose()
    }
  })
})
