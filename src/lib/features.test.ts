import { describe, expect, it } from "bun:test"

import { isRecord } from "#lib/is-record"
import { createTestRuntime } from "#lib/protocol/test-support"

import { createFeatures } from "./features"

const featureNames = [
  "theme",
  "viewport",
  "backButton",
  "mainButton",
  "secondaryButton",
  "settingsButton",
  "closingBehavior",
  "swipeBehavior",
  "haptics",
  "links",
  "downloads",
  "writeAccess",
  "dialogs",
  "clipboard",
] as const

const createRegistry = (platform = "ios", version = "9.6") => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { innerHeight: 800, innerWidth: 400 },
  })
  const environment = createTestRuntime(platform, version)
  const registry = createFeatures(environment.runtime, {
    platform,
    isFullscreen: false,
  })
  const restoreWindow = (): void => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(globalThis, "window")
    } else {
      Object.defineProperty(globalThis, "window", descriptor)
    }
  }
  return { environment, restoreWindow, ...registry }
}

const readRequestId = (eventData: string | undefined): string => {
  const parsed: unknown = JSON.parse(eventData ?? "null")
  return isRecord(parsed) && typeof parsed.req_id === "string" ? parsed.req_id : ""
}

describe("feature registry", () => {
  it("exposes the uniform controller contract on every feature", () => {
    const { environment, restoreWindow, features } = createRegistry()
    try {
      expect(Object.keys(features).toSorted()).toEqual([...featureNames].toSorted())

      for (const name of featureNames) {
        const controller = features[name]
        expect(typeof controller.supported).toBe("boolean")
        expect(typeof controller.state.get).toBe("function")
        expect(typeof controller.state.subscribe).toBe("function")
        expect(typeof controller.actions).toBe("object")
        expect(controller.actions).not.toBeNull()

        const unsubscribe = controller.state.subscribe(() => undefined)
        expect(typeof unsubscribe).toBe("function")
        unsubscribe()
      }
    } finally {
      environment.dispose()
      restoreWindow()
    }
  })

  it("derives supported from the protocol table", () => {
    const desktop = createRegistry("macos")
    try {
      expect(desktop.features.haptics.supported).toBe(false)
      expect(desktop.features.theme.supported).toBe(true)
      expect(desktop.features.viewport.supported).toBe(true)
    } finally {
      desktop.environment.dispose()
      desktop.restoreWindow()
    }
  })

  it("tracks controller state as actions run", async () => {
    const { environment, restoreWindow, features } = createRegistry()
    try {
      environment.emit("theme_changed", { theme_params: { bg_color: "#ffffff" } })
      expect(features.theme.state.get().colorScheme).toBe("light")

      features.backButton.actions.show()
      expect(features.backButton.state.get().isVisible).toBe(true)

      features.mainButton.actions.set({ isVisible: true, text: "Go" })
      expect(features.mainButton.state.get()).toMatchObject({ isVisible: true, text: "Go" })

      features.secondaryButton.actions.set({ isVisible: true, text: "Back" })
      expect(features.secondaryButton.state.get()).toMatchObject({ isVisible: true, text: "Back" })

      features.settingsButton.actions.show()
      expect(features.settingsButton.state.get().isVisible).toBe(true)

      features.closingBehavior.actions.enable()
      expect(features.closingBehavior.state.get().isEnabled).toBe(true)

      features.swipeBehavior.actions.disableVertical()
      expect(features.swipeBehavior.state.get().isVerticalEnabled).toBe(false)

      const download = features.downloads.actions.request("https://example.com/a.pdf", "a.pdf")
      environment.emit("file_download_requested", { status: "cancelled" })
      expect(await download).toBe("cancelled")
      expect(features.downloads.state.get().status).toBe("cancelled")

      const write = features.writeAccess.actions.request()
      environment.emit("write_access_requested", { status: "allowed" })
      await write
      expect(features.writeAccess.state.get().status).toBe("allowed")

      const dialog = features.dialogs.actions.show({
        message: "Hi",
        buttons: [{ id: "ok", type: "ok" }],
      })
      expect(features.dialogs.state.get().isOpen).toBe(true)
      environment.emit("popup_closed", { button_id: "ok" })
      expect(await dialog).toBe("ok")
      expect(features.dialogs.state.get().isOpen).toBe(false)

      const clipboard = features.clipboard.actions.read()
      environment.emit("clipboard_text_received", {
        req_id: readRequestId(environment.posts.at(-1)?.eventData),
        data: "text",
      })
      expect(await clipboard).toBe("text")
      expect(features.clipboard.state.get().text).toBe("text")
    } finally {
      environment.dispose()
      restoreWindow()
    }
  })
})
