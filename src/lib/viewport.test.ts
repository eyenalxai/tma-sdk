import { describe, expect, it } from "bun:test"

import type { ProtocolWindow } from "#lib/protocol/transport"

import { createProtocol } from "#lib/protocol/client"

import type { TelegramRuntime } from "./telegram-runtime"

import { createDisposer } from "./disposer"
import { createViewport } from "./viewport"

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve()
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

const createTestEnvironment = (platform: string) => {
  const posts: string[] = []
  const { fakeWindow, restore } = installFakeWindow(posts)
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

  it("requests the viewport on macOS and finishes when the null payload arrives", async () => {
    const environment = createTestEnvironment("macos")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "macos",
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

      environment.emit("viewport_changed", null)
      await mountTracking

      expect(isMounted).toBe(true)
      expect(viewport.store.get().height).toBe(800)
      expect(viewport.store.get().isExpanded).toBe(true)
      expect(environment.posts).toEqual(["web_app_request_viewport", "web_app_request_safe_area"])
    } finally {
      environment.restoreWindow()
    }
  })

  it("mounts Web K without requesting a viewport it never answers", async () => {
    const environment = createTestEnvironment("webk")
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "webk",
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
