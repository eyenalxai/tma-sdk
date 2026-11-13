import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createHaptics } from "./haptic-feedback"

const readParams = (eventData: string | undefined): unknown => JSON.parse(eventData ?? "null")

describe("createHaptics", () => {
  it("exposes a stateless store and posts each feedback type", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const haptics = createHaptics(environment.runtime)
      expect(haptics.supported).toBe(true)
      expect(haptics.state.get()).toBeNull()
      expect(typeof haptics.state.subscribe(() => undefined)).toBe("function")

      haptics.actions.impact("light")
      haptics.actions.notification("success")
      haptics.actions.selection()

      expect(environment.posts.map((post) => readParams(post.eventData))).toEqual([
        { type: "impact", impact_style: "light" },
        { type: "notification", notification_type: "success" },
        { type: "selection_change" },
      ])
    } finally {
      environment.dispose()
    }
  })

  it("does not post where the client has no haptics", () => {
    const environment = createTestRuntime("macos", "9.6")
    try {
      const haptics = createHaptics(environment.runtime)
      expect(haptics.supported).toBe(false)

      haptics.actions.impact("heavy")

      expect(environment.posts).toEqual([])
    } finally {
      environment.dispose()
    }
  })
})
