import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import type { ThemeCssVariableTarget } from "./theme-css-vars"

import { createTheme } from "./theme"

const createTarget = () => {
  const properties = new Map<string, string>()
  const target: ThemeCssVariableTarget = {
    style: {
      setProperty: (property, value) => {
        properties.set(property, value ?? "")
      },
      removeProperty: (property) => {
        properties.delete(property)
        return ""
      },
    },
  }

  return { properties, target }
}

const themePayload = {
  theme_params: {
    bg_color: "#ffffff",
    secondary_bg_color: "#f0f0f0",
    button_color: "#2481cc",
  },
  color_scheme: "light",
}

describe("createTheme", () => {
  it("starts empty and records the payload from theme_changed", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const theme = createTheme(environment.runtime)
      expect(theme.supported).toBe(true)
      expect(theme.state.get()).toEqual({ themeParams: {}, colorScheme: null })

      environment.emit("theme_changed", themePayload)

      expect(theme.state.get()).toEqual({
        themeParams: themePayload.theme_params,
        colorScheme: "light",
      })
    } finally {
      environment.dispose()
    }
  })

  it("requests the theme and resolves with the stored state", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const theme = createTheme(environment.runtime)
      const request = theme.actions.request()
      expect(environment.posts.map((post) => post.eventType)).toEqual(["web_app_request_theme"])

      environment.emit("theme_changed", themePayload)

      const themeState = await request
      expect(themeState).toEqual({
        themeParams: themePayload.theme_params,
        colorScheme: "light",
      })
    } finally {
      environment.dispose()
    }
  })

  it("binds the theme parameters as Telegram CSS variables", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const theme = createTheme(environment.runtime)
      const { properties, target } = createTarget()

      const unbind = theme.actions.bindCssVars(target)
      expect(properties.size).toBe(0)

      environment.emit("theme_changed", themePayload)

      expect(properties.get("--tg-theme-bg-color")).toBe("#ffffff")
      expect(properties.get("--tg-theme-secondary-bg-color")).toBe("#f0f0f0")
      expect(properties.get("--tg-theme-button-color")).toBe("#2481cc")
      expect(properties.get("--tg-color-scheme")).toBe("light")

      unbind()
      expect(properties.size).toBe(0)
    } finally {
      environment.dispose()
    }
  })

  it("posts header, background and bottom-bar colors", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const theme = createTheme(environment.runtime)

      theme.actions.setHeaderColor("#ffffff")
      theme.actions.setBackgroundColor("#000000")
      theme.actions.setBottomBarColor("#111111")

      expect(environment.posts).toEqual([
        { eventType: "web_app_set_header_color", eventData: '{"color":"#ffffff"}' },
        { eventType: "web_app_set_background_color", eventData: '{"color":"#000000"}' },
        { eventType: "web_app_set_bottom_bar_color", eventData: '{"color":"#111111"}' },
      ])
    } finally {
      environment.dispose()
    }
  })

  it("omits an RGB header color below 6.9", () => {
    const environment = createTestRuntime("ios", "6.8")
    try {
      const theme = createTheme(environment.runtime)

      theme.actions.setHeaderColor("#ffffff")
      theme.actions.setBackgroundColor("#000000")

      expect(environment.posts).toEqual([
        { eventType: "web_app_set_background_color", eventData: '{"color":"#000000"}' },
      ])
    } finally {
      environment.dispose()
    }
  })

  it("leaves the color scheme null when the payload omits it", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const theme = createTheme(environment.runtime)

      environment.emit("theme_changed", { theme_params: { bg_color: "#000000" } })

      expect(theme.state.get()).toEqual({
        themeParams: { bg_color: "#000000" },
        colorScheme: null,
      })
    } finally {
      environment.dispose()
    }
  })
})
