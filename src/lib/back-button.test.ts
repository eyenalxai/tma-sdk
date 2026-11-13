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
      expect(backButton.feature.state.get().isVisible).toBe(false)

      backButton.sync()

      expect(visibilityPosts(environment.posts)).toEqual(['{"is_visible":false}'])
      backButton.feature.actions.hide()
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
      backButton.feature.actions.show()
      backButton.feature.actions.show()
      backButton.feature.actions.hide()
      backButton.feature.actions.hide()

      expect(visibilityPosts(environment.posts)).toEqual([
        '{"is_visible":false}',
        '{"is_visible":true}',
        '{"is_visible":false}',
      ])
      expect(backButton.feature.state.get().isVisible).toBe(false)
    } finally {
      environment.dispose()
    }
  })

  it("delivers back_button_pressed through the feature", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const backButton = createBackButton(environment.runtime)
      let presses = 0
      const unsubscribe = backButton.feature.actions.onClick(() => {
        presses += 1
      })

      environment.emit("back_button_pressed", null)
      unsubscribe()
      environment.emit("back_button_pressed", null)

      expect(presses).toBe(1)
    } finally {
      environment.dispose()
    }
  })
})
