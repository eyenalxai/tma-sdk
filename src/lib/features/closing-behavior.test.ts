import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createClosingBehavior } from "./closing-behavior"

const readParams = (eventData: string): unknown => {
  const parsed: unknown = JSON.parse(eventData)
  return parsed
}

const confirmationParams = (posts: { eventData: string }[]): unknown[] =>
  posts.map((post) => readParams(post.eventData))

describe("createClosingBehavior", () => {
  it("starts disabled and sends only confirmation changes", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const closingBehavior = createClosingBehavior(environment.runtime)
      expect(closingBehavior.supported).toBe(true)
      expect(closingBehavior.state.get().isEnabled).toBe(false)

      closingBehavior.actions.enable()
      closingBehavior.actions.enable()
      closingBehavior.actions.disable()
      closingBehavior.actions.disable()

      expect(confirmationParams(environment.posts)).toEqual([
        { need_confirmation: true },
        { need_confirmation: false },
      ])
      expect(closingBehavior.state.get().isEnabled).toBe(false)
    } finally {
      environment.dispose()
    }
  })
})
