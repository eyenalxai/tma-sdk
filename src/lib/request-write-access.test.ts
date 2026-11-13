import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createWriteAccess } from "./request-write-access"

describe("createWriteAccess", () => {
  it("returns allowed and stores the status", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const writeAccess = createWriteAccess(environment.runtime)
      expect(writeAccess.supported).toBe(true)
      expect(writeAccess.state.get().status).toBeNull()

      const request = writeAccess.actions.request()
      expect(environment.posts.map((post) => post.eventType)).toEqual([
        "web_app_request_write_access",
      ])

      environment.emit("write_access_requested", { status: "allowed" })

      expect(await request).toBe("allowed")
      expect(writeAccess.state.get().status).toBe("allowed")
    } finally {
      environment.dispose()
    }
  })

  it("returns cancelled and stores the status", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const writeAccess = createWriteAccess(environment.runtime)

      const request = writeAccess.actions.request()
      environment.emit("write_access_requested", { status: "cancelled" })

      expect(await request).toBe("cancelled")
      expect(writeAccess.state.get().status).toBe("cancelled")
    } finally {
      environment.dispose()
    }
  })
})
