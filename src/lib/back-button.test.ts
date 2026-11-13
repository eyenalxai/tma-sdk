import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createBackButton } from "./back-button"

const visibilityPosts = (posts: { eventData: string }[]): string[] =>
  posts.map((post) => post.eventData)

describe("createBackButton", () => {
  it("posts the desired visibility even when the store already says hidden", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const backButton = createBackButton(environment.runtime)
      expect(backButton.store.get().isVisible).toBe(false)

      backButton.sync()

      expect(visibilityPosts(environment.posts)).toEqual(['{"is_visible":false}'])
      backButton.hide()
      expect(visibilityPosts(environment.posts)).toEqual(['{"is_visible":false}'])
    } finally {
      environment.dispose()
    }
  })

  it("sends only visibility changes after sync", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const backButton = createBackButton(environment.runtime)

      backButton.sync()
      backButton.show()
      backButton.show()
      backButton.hide()
      backButton.hide()

      expect(visibilityPosts(environment.posts)).toEqual([
        '{"is_visible":false}',
        '{"is_visible":true}',
        '{"is_visible":false}',
      ])
      expect(backButton.store.get().isVisible).toBe(false)
    } finally {
      environment.dispose()
    }
  })
})
