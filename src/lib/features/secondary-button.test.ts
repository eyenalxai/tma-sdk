import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createSecondaryButton } from "./secondary-button"

const readParams = (eventData: string | undefined): unknown => JSON.parse(eventData ?? "null")

describe("createSecondaryButton", () => {
  it("starts hidden with the secondary defaults", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const secondaryButton = createSecondaryButton(environment.runtime)
      expect(secondaryButton.supported).toBe(true)
      expect(secondaryButton.state.get()).toMatchObject({
        isVisible: false,
        isActive: true,
        text: "Cancel",
        position: "left",
      })
    } finally {
      environment.dispose()
    }
  })

  it("posts the position with the full button state", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const secondaryButton = createSecondaryButton(environment.runtime)

      secondaryButton.actions.set({ isVisible: true, text: "Back", position: "right" })

      expect(readParams(environment.posts[0]?.eventData)).toEqual({
        is_visible: true,
        is_active: true,
        is_progress_visible: false,
        text: "Back",
        position: "right",
        has_shine_effect: false,
      })
    } finally {
      environment.dispose()
    }
  })

  it("delivers secondary_button_pressed until the listener unsubscribes", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const secondaryButton = createSecondaryButton(environment.runtime)
      let presses = 0
      const unsubscribe = secondaryButton.actions.onClick(() => {
        presses += 1
      })

      environment.emit("secondary_button_pressed", null)
      unsubscribe()
      environment.emit("secondary_button_pressed", null)

      expect(presses).toBe(1)
    } finally {
      environment.dispose()
    }
  })
})
