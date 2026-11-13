import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createSettingsButton } from "./settings-button"

const readParams = (eventData: string): unknown => {
  const parsed: unknown = JSON.parse(eventData)
  return parsed
}

const visibilityParams = (posts: { eventData: string }[]): unknown[] =>
  posts.map((post) => readParams(post.eventData))

describe("createSettingsButton", () => {
  it("starts hidden and sends only visibility changes", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const settingsButton = createSettingsButton(environment.runtime)
      expect(settingsButton.supported).toBe(true)
      expect(settingsButton.state.get().isVisible).toBe(false)

      settingsButton.actions.show()
      settingsButton.actions.show()
      settingsButton.actions.hide()
      settingsButton.actions.hide()

      expect(visibilityParams(environment.posts)).toEqual([
        { is_visible: true },
        { is_visible: false },
      ])
      expect(settingsButton.state.get().isVisible).toBe(false)
    } finally {
      environment.dispose()
    }
  })

  it("sets visibility through the uniform set action", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const settingsButton = createSettingsButton(environment.runtime)

      settingsButton.actions.set({ isVisible: true })

      expect(settingsButton.state.get().isVisible).toBe(true)
      expect(visibilityParams(environment.posts)).toEqual([{ is_visible: true }])
    } finally {
      environment.dispose()
    }
  })

  it("delivers settings_button_pressed until the listener unsubscribes", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const settingsButton = createSettingsButton(environment.runtime)
      let presses = 0
      const unsubscribe = settingsButton.actions.onClick(() => {
        presses += 1
      })

      environment.emit("settings_button_pressed", null)
      unsubscribe()
      environment.emit("settings_button_pressed", null)

      expect(presses).toBe(1)
    } finally {
      environment.dispose()
    }
  })
})
