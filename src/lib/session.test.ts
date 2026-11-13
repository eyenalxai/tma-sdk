/* oxlint-disable max-lines */
import { describe, expect, it } from "bun:test"

import type { EventName, EventPayloads } from "#lib/protocol/methods"
import type { ProtocolWindow } from "#lib/protocol/transport"

import { isRecord } from "#lib/is-record"

import { createSession } from "./session"
import { installEarlyEventCapture } from "./session/replay"

type NativePost = { eventType: string; eventData: string }

type TestEnvironment = {
  fakeWindow: ProtocolWindow
  posts: NativePost[]
  emit: (eventType: string, eventData?: unknown) => void
  restore: () => void
}

const installFakeWindow = (search = ""): TestEnvironment => {
  const posts: NativePost[] = []
  const fakeWindow: ProtocolWindow = {
    innerHeight: 800,
    innerWidth: 400,
    location: { href: `https://app.example/${search}` },
    TelegramWebviewProxy: {
      postEvent: (eventType: string, eventData: string) => {
        posts.push({ eventType, eventData })
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
    posts,
    emit: (eventType, eventData) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const receive = fakeWindow.TelegramGameProxy_receiveEvent as (
        eventType: string,
        eventData?: unknown,
      ) => void
      receive(eventType, eventData)
    },
    restore: () => {
      if (descriptor === undefined) {
        Reflect.deleteProperty(globalThis, "window")
      } else {
        Object.defineProperty(globalThis, "window", descriptor)
      }
    },
  }
}

/**
 * A document without a document element lets the session be constructed but
 * makes the CSS-variable binding fail during start, without touching features.
 */
const installDocumentWithoutRoot = (): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document")
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      createElement: () => {
        return { id: "", innerHTML: "", remove: () => undefined }
      },
      head: { append: () => undefined },
    },
  })

  return () => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(globalThis, "document")
    } else {
      Object.defineProperty(globalThis, "document", descriptor)
    }
  }
}

const launchWithoutInitData = "?tgWebAppPlatform=ios&tgWebAppVersion=9.6"
const desktopLaunchWithoutInitData = "?tgWebAppPlatform=web&tgWebAppVersion=9.6"

const viewportPayload = {
  height: 640,
  width: 320,
  is_state_stable: true,
  is_expanded: false,
}

const countPosts = (posts: NativePost[], eventType: string): number =>
  posts.filter((post) => post.eventType === eventType).length

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

describe("createSession", () => {
  it("returns synchronously when the launch has no init data", () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()

      expect(session.launch.tgWebAppPlatform).toBe("ios")
      expect(session.initData).toBeNull()
      expect(session.status.get()).toBe("launched")
      expect("set" in session.status).toBe(false)
      expect("update" in session.status).toBe(false)
      expect(() => session.requireInitData()).toThrow("init data")
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("installs the inbound bridge before it returns", () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()

      expect(typeof environment.fakeWindow.TelegramGameProxy_receiveEvent).toBe("function")
      const gameProxy = environment.fakeWindow.TelegramGameProxy
      expect(isRecord(gameProxy)).toBe(true)
      expect(isRecord(gameProxy) ? typeof gameProxy.receiveEvent : null).toBe("function")
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("parses init data when the launch carries it", () => {
    const initDataQuery = new URLSearchParams({
      auth_date: "1700000000",
      hash: "a".repeat(64),
      user: JSON.stringify({ id: 1, first_name: "Ada" }),
    }).toString()
    const environment = installFakeWindow(
      `?tgWebAppPlatform=ios&tgWebAppVersion=9.6&tgWebAppData=${encodeURIComponent(initDataQuery)}`,
    )
    try {
      const session = createSession()

      expect(session.initData?.user).toMatchObject({ id: 1, first_name: "Ada" })
      expect(session.initData).toEqual(session.requireInitData())
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("replays the last stateful payload to a late subscriber", () => {
    const cases: { event: EventName; payload: EventPayloads[EventName] }[] = [
      {
        event: "viewport_changed",
        payload: { height: 640, width: 320, is_state_stable: true, is_expanded: false },
      },
      { event: "fullscreen_changed", payload: { is_fullscreen: true } },
      { event: "safe_area_changed", payload: { top: 1, bottom: 2, left: 3, right: 4 } },
      { event: "content_safe_area_changed", payload: { top: 5, bottom: 6, left: 7, right: 8 } },
      { event: "theme_changed", payload: { theme_params: { bg_color: "#ffffff" } } },
      { event: "visibility_changed", payload: { is_visible: false } },
    ]

    for (const { event, payload } of cases) {
      const environment = installFakeWindow(launchWithoutInitData)
      try {
        const session = createSession()
        environment.emit(event, payload)
        const received: EventPayloads[EventName][] = []
        session.protocol.on(event, (eventPayload) => {
          received.push(eventPayload)
        })

        expect(received).toEqual([payload])
        session.destroy()
      } finally {
        environment.restore()
      }
    }
  })

  it("does not replay an event that is not stateful", () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      environment.emit("back_button_pressed", null)
      const received: null[] = []
      session.protocol.on("back_button_pressed", (payload) => {
        received.push(payload)
      })

      expect(received).toEqual([])
      environment.emit("back_button_pressed", null)
      expect(received).toEqual([null])
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("does not replay stateful events that never arrived", () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      const received: unknown[] = []
      session.protocol.on("theme_changed", (payload) => {
        received.push(payload)
      })

      expect(received).toEqual([])
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("delivers an event that arrived before createSession to the first subscriber", async () => {
    const environment = installFakeWindow(desktopLaunchWithoutInitData)
    try {
      installEarlyEventCapture(environment.fakeWindow)
      environment.emit("viewport_changed", viewportPayload)

      const session = createSession()
      const received: unknown[] = []
      session.protocol.on("viewport_changed", (payload) => {
        received.push(payload)
      })

      expect(received).toEqual([viewportPayload])

      await session.start()
      expect(session.initData).toBeNull()
      expect(session.features.viewport.store.get()).toMatchObject({
        height: 640,
        width: 320,
      })
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("mounts the viewport and requests initial state on start", async () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      const started = session.start()
      await flushMicrotasks()

      expect(session.status.get()).toBe("launched")
      expect(environment.posts.map((post) => post.eventType)).toEqual([
        "web_app_request_theme",
        "web_app_setup_back_button",
        "web_app_request_viewport",
      ])

      environment.emit("viewport_changed", {
        height: 640,
        is_state_stable: true,
        is_expanded: true,
      })
      await started

      expect(session.status.get()).toBe("mounted")
      expect(environment.posts.map((post) => post.eventType)).toEqual([
        "web_app_request_theme",
        "web_app_setup_back_button",
        "web_app_request_viewport",
        "web_app_request_safe_area",
        "web_app_request_content_safe_area",
      ])
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("starts once and keeps markReady separate", async () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      const started = session.start()
      void session.start()

      await flushMicrotasks()
      environment.emit("viewport_changed", {
        height: 640,
        is_state_stable: true,
        is_expanded: true,
      })
      await started

      expect(countPosts(environment.posts, "web_app_request_viewport")).toBe(1)
      expect(session.status.get()).toBe("mounted")

      session.markReady()
      session.markReady()

      expect(session.status.get()).toBe("ready")
      expect(countPosts(environment.posts, "web_app_ready")).toBe(1)
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("does not mark ready before the session is mounted", async () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      session.markReady()

      expect(session.status.get()).toBe("launched")
      expect(countPosts(environment.posts, "web_app_ready")).toBe(0)

      const started = session.start()
      await flushMicrotasks()
      environment.emit("viewport_changed", {
        height: 640,
        is_state_stable: true,
        is_expanded: true,
      })
      await started

      expect(session.status.get()).toBe("mounted")
      expect(countPosts(environment.posts, "web_app_ready")).toBe(0)

      session.markReady()

      expect(session.status.get()).toBe("ready")
      expect(countPosts(environment.posts, "web_app_ready")).toBe(1)
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("reconciles native chrome when the session starts", async () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      const started = session.start()
      await flushMicrotasks()

      const backButtonPost = environment.posts.find(
        (post) => post.eventType === "web_app_setup_back_button",
      )
      expect(backButtonPost?.eventData).toBe('{"is_visible":false}')

      environment.emit("viewport_changed", {
        height: 640,
        is_state_stable: true,
        is_expanded: true,
      })
      await started

      const entering = session.features.viewport.requestFullscreen()
      environment.emit("fullscreen_failed", { error: "ALREADY_FULLSCREEN" })
      await entering

      expect(session.features.viewport.store.get().isFullscreen).toBe(true)
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("keeps a failed session failed until destroy", async () => {
    const environment = installFakeWindow(desktopLaunchWithoutInitData)
    const restoreDocument = installDocumentWithoutRoot()
    try {
      const session = createSession()

      const startFailure = await catchFailure(session.start())
      expect(startFailure).toBeInstanceOf(Error)
      expect(session.status.get()).toBe("failed")

      session.markReady()
      expect(session.status.get()).toBe("failed")
      expect(countPosts(environment.posts, "web_app_ready")).toBe(0)

      const retryFailure = await catchFailure(session.start())
      expect(retryFailure instanceof Error ? retryFailure.message : "").toContain("failed")
      expect(session.status.get()).toBe("failed")

      session.destroy()
      expect(session.status.get()).toBe("closed")
    } finally {
      restoreDocument()
      environment.restore()
    }
  })

  it("closes once and refuses to start after destroy", async () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()

      session.destroy()
      session.destroy()

      expect(session.status.get()).toBe("closed")
      const closedFailure = await catchFailure(session.start())
      expect(closedFailure).toBeInstanceOf(Error)
      expect(closedFailure instanceof Error ? closedFailure.message : "").toContain("closed")
      expect(() => session.protocol.on("viewport_changed", () => undefined)).toThrow("destroyed")
    } finally {
      environment.restore()
    }
  })
})
