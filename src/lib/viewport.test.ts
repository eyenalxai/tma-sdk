/* oxlint-disable max-lines */
import { describe, expect, it } from "bun:test"

import type { ProtocolWindow } from "#lib/protocol/transport"

import { createProtocol } from "#lib/protocol/client"

import type { TelegramRuntime } from "./telegram-runtime"

import { createDisposer } from "./disposer"
import { createViewport } from "./viewport"

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve()
}

const catchFailure = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("Expected the promise to reject")
}

const installFakeWindow = (posts: string[]) => {
  const fakeWindow: ProtocolWindow = {
    innerHeight: 800,
    innerWidth: 400,
    TelegramWebviewProxy: {
      // Records posts routed through the real protocol transport.
      postEvent: (method: string) => {
        posts.push(method)
      },
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  fakeWindow.self = fakeWindow
  fakeWindow.top = fakeWindow
  fakeWindow.parent = fakeWindow

  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: fakeWindow,
  })

  return {
    fakeWindow,
    restore: () => {
      if (descriptor === undefined) {
        Reflect.deleteProperty(globalThis, "window")
      } else {
        Object.defineProperty(globalThis, "window", descriptor)
      }
    },
  }
}

const createTestEnvironment = (platform: string, ancestorOrigin?: string) => {
  const posts: string[] = []
  const { fakeWindow, restore } = installFakeWindow(posts)
  if (ancestorOrigin !== undefined) {
    fakeWindow.location = { ancestorOrigins: [ancestorOrigin] }
  }
  const disposer = createDisposer()
  const abortController = new AbortController()
  const protocol = createProtocol({
    platform,
    version: "9.6",
    window: fakeWindow,
    signal: abortController.signal,
  })
  // Mirrors the session teardown order: abort in-flight requests, then destroy the protocol.
  disposer.add(() => {
    protocol.destroy()
  })
  disposer.add(() => {
    abortController.abort()
  })
  const runtime: TelegramRuntime = { protocol, disposer }

  return {
    runtime,
    posts,
    dispose: () => {
      disposer.dispose()
    },
    emit: (eventType: string, eventData?: unknown) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const receive = fakeWindow.TelegramGameProxy_receiveEvent as (
        eventType: string,
        eventData?: unknown,
      ) => void
      receive(eventType, eventData)
    },
    restoreWindow: restore,
  }
}

describe("createViewport", () => {
  it("mounts web embeds without requesting the viewport", async () => {
    const environment = createTestEnvironment("web")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "web",
        isFullscreen: false,
      })

      await viewport.mount()

      expect(environment.posts).toEqual([
        "web_app_request_safe_area",
        "web_app_request_content_safe_area",
      ])
      expect(viewport.store.get().isExpanded).toBe(true)
    } finally {
      environment.restoreWindow()
    }
  })

  it("waits for the viewport event on mobile platforms", async () => {
    const environment = createTestEnvironment("ios")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "ios",
        isFullscreen: false,
      })

      let isMounted = false
      const mountTracking = (async () => {
        await viewport.mount()
        isMounted = true
      })()
      await flushMicrotasks()

      expect(isMounted).toBe(false)
      expect(environment.posts).toEqual(["web_app_request_viewport"])

      environment.emit("viewport_changed", {
        height: 640,
        is_state_stable: true,
        is_expanded: true,
      })
      await mountTracking

      expect(isMounted).toBe(true)
      expect(viewport.store.get().height).toBe(640)
      expect(environment.posts).toEqual([
        "web_app_request_viewport",
        "web_app_request_safe_area",
        "web_app_request_content_safe_area",
      ])
    } finally {
      environment.restoreWindow()
    }
  })

  it("merges partial safe-area payloads into the stored insets", async () => {
    const environment = createTestEnvironment("web")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "web",
        isFullscreen: false,
      })
      await viewport.mount()

      environment.emit("safe_area_changed", { top: 12, bottom: 8, left: 4, right: 2 })
      environment.emit("content_safe_area_changed", { left: 3, right: 1 })
      environment.emit("safe_area_changed", { top: 20 })
      environment.emit("content_safe_area_changed", { bottom: 6 })

      expect(viewport.store.get().safeAreaInsets).toEqual({
        top: 20,
        bottom: 8,
        left: 4,
        right: 2,
      })
      expect(viewport.store.get().contentSafeAreaInsets).toEqual({
        top: 0,
        bottom: 6,
        left: 3,
        right: 1,
      })
    } finally {
      environment.restoreWindow()
    }
  })

  it("treats ALREADY_FULLSCREEN as success when exiting fullscreen while windowed", async () => {
    const environment = createTestEnvironment("ios")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "ios",
        isFullscreen: false,
      })

      const exiting = viewport.exitFullscreen()
      environment.emit("fullscreen_failed", { error: "ALREADY_FULLSCREEN" })
      await exiting

      expect(viewport.store.get().isFullscreen).toBe(false)
      expect(environment.posts).toContain("web_app_exit_fullscreen")
    } finally {
      environment.restoreWindow()
    }
  })

  it("treats ALREADY_FULLSCREEN as success when entering fullscreen while already fullscreen", async () => {
    const environment = createTestEnvironment("ios")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "ios",
        isFullscreen: true,
      })

      const entering = viewport.requestFullscreen()
      environment.emit("fullscreen_failed", { error: "ALREADY_FULLSCREEN" })
      await entering

      expect(viewport.store.get().isFullscreen).toBe(true)
      expect(environment.posts).toContain("web_app_request_fullscreen")
    } finally {
      environment.restoreWindow()
    }
  })

  it("still rejects an unsupported fullscreen transition", async () => {
    const environment = createTestEnvironment("ios")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "ios",
        isFullscreen: false,
      })

      const entering = viewport.requestFullscreen()
      environment.emit("fullscreen_failed", { error: "UNSUPPORTED" })
      const failure = await catchFailure(entering)

      expect(failure instanceof Error ? failure.message : "").toContain("UNSUPPORTED")
      expect(viewport.store.get().isFullscreen).toBe(false)
    } finally {
      environment.restoreWindow()
    }
  })

  it("mounts macOS without requesting the null viewport", async () => {
    const environment = createTestEnvironment("macos")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "macos",
        isFullscreen: false,
      })

      await viewport.mount()

      expect(viewport.store.get().height).toBe(800)
      expect(viewport.store.get().isExpanded).toBe(true)
      expect(environment.posts).toEqual(["web_app_request_safe_area"])
    } finally {
      environment.restoreWindow()
    }
  })

  it("mounts Web K without requesting a viewport it never answers", async () => {
    const environment = createTestEnvironment("web", "https://webk.telegram.org")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "web",
        isFullscreen: false,
      })

      await viewport.mount()

      expect(environment.posts).toEqual([])
      expect(viewport.store.get().isExpanded).toBe(true)
    } finally {
      environment.restoreWindow()
    }
  })

  it("does not post safe-area requests when disposed while waiting", async () => {
    const environment = createTestEnvironment("ios")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "ios",
        isFullscreen: false,
      })

      const mount = viewport.mount()
      await flushMicrotasks()
      environment.dispose()
      await mount

      expect(environment.posts).toEqual(["web_app_request_viewport"])
    } finally {
      environment.restoreWindow()
    }
  })
})
