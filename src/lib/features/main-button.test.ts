import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createMainButton } from "./main-button"

const readParams = (eventData: string | undefined): unknown => JSON.parse(eventData ?? "null")

describe("createMainButton", () => {
  it("starts hidden and posts only the visibility while hidden", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const mainButton = createMainButton(environment.runtime)
      expect(mainButton.supported).toBe(true)
      expect(mainButton.state.get()).toMatchObject({
        isVisible: false,
        isActive: true,
        text: "Continue",
      })

      mainButton.actions.set({ isVisible: true })

      expect(readParams(environment.posts[0]?.eventData)).toEqual({
        is_visible: true,
        is_active: true,
        is_progress_visible: false,
        text: "Continue",
        has_shine_effect: false,
      })
      expect(mainButton.state.get().isVisible).toBe(true)
    } finally {
      environment.dispose()
    }
  })

  it("merges partial updates and posts the full button state", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const mainButton = createMainButton(environment.runtime)

      mainButton.actions.set({
        isVisible: true,
        text: "Pay",
        color: "#2481cc",
        textColor: "#ffffff",
        iconCustomEmojiId: "5368324170671202286",
      })

      expect(readParams(environment.posts[0]?.eventData)).toEqual({
        is_visible: true,
        is_active: true,
        is_progress_visible: false,
        text: "Pay",
        color: "#2481cc",
        text_color: "#ffffff",
        icon_custom_emoji_id: "5368324170671202286",
        has_shine_effect: false,
      })
      expect(mainButton.state.get()).toMatchObject({
        text: "Pay",
        color: "#2481cc",
        textColor: "#ffffff",
      })
    } finally {
      environment.dispose()
    }
  })

  it("drops the shine effect while the button is inactive or loading", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const mainButton = createMainButton(environment.runtime)

      mainButton.actions.set({ isVisible: true, hasShineEffect: true })
      expect(readParams(environment.posts[0]?.eventData)).toMatchObject({
        has_shine_effect: true,
      })

      mainButton.actions.set({ isActive: false })
      expect(readParams(environment.posts[1]?.eventData)).toMatchObject({
        is_active: false,
        has_shine_effect: false,
      })

      mainButton.actions.set({ isActive: true, isProgressVisible: true })
      expect(readParams(environment.posts[2]?.eventData)).toMatchObject({
        is_progress_visible: true,
        has_shine_effect: false,
      })
    } finally {
      environment.dispose()
    }
  })

  it("delivers main_button_pressed until the listener unsubscribes", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const mainButton = createMainButton(environment.runtime)
      let presses = 0
      const unsubscribe = mainButton.actions.onClick(() => {
        presses += 1
      })

      environment.emit("main_button_pressed", null)
      unsubscribe()
      environment.emit("main_button_pressed", null)

      expect(presses).toBe(1)
    } finally {
      environment.dispose()
    }
  })
})
