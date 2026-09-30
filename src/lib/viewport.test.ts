import { describe, expect, it } from "bun:test"

import type { TelegramEventSink } from "./event-bridge"
import type { PostEventArgs } from "./post-event"
import type { TelegramRuntime } from "./telegram-runtime"

import { createDisposer } from "./disposer"
import { createEventHub } from "./event-hub"
import { createRequest } from "./request"
import { createViewport } from "./viewport"

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve()
}

const installFakeWindow = (posts: string[]) => {
  const fakeWindow: Record<string, unknown> = {
    innerHeight: 800,
    innerWidth: 400,
    TelegramWebviewProxy: {
      // Records posts routed through the real postEvent.
      postEvent: (method: string) => {
        posts.push(method)
      },
    },
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

  return () => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(globalThis, "window")
    } else {
      Object.defineProperty(globalThis, "window", descriptor)
    }
  }
}

const createTestEnvironment = () => {
  const posts: string[] = []
  const restoreWindow = installFakeWindow(posts)

  let sink: TelegramEventSink | null = null
  const hub = createEventHub((nextSink) => {
    sink = nextSink
    return () => {
      sink = null
    }
  })
  const disposer = createDisposer()
  const abortController = new AbortController()
  // Mirrors the session teardown order: abort in-flight requests, then destroy the hub.
  disposer.add(() => {
    hub.destroy()
  })
  disposer.add(() => {
    abortController.abort()
  })
  const request = createRequest({
    hub,
    signal: abortController.signal,
    postEvent: (...args: PostEventArgs) => {
      posts.push(args[0])
    },
  })
  const runtime: TelegramRuntime = { version: "9.6", hub, request, disposer }

  return {
    runtime,
    posts,
    dispose: () => {
      disposer.dispose()
    },
    emit: (eventType: string, eventData?: unknown) => {
      sink?.(eventType, eventData)
    },
    restoreWindow,
  }
}

describe("createViewport", () => {
  it("mounts desktop platforms without requesting the viewport", async () => {
    const environment = createTestEnvironment()
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
    const environment = createTestEnvironment()
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

  it("skips the content safe-area request on macOS", async () => {
    const environment = createTestEnvironment()
    try {
      const viewport = createViewport(environment.runtime, {
        platform: "macos",
        isFullscreen: false,
      })

      await viewport.mount()

      expect(environment.posts).toEqual(["web_app_request_safe_area"])
    } finally {
      environment.restoreWindow()
    }
  })

  it("does not post safe-area requests when disposed while waiting", async () => {
    const environment = createTestEnvironment()
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
