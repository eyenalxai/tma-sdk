/* oxlint-disable max-lines */
import { describe, expect, it } from "bun:test"

import type { EventName, EventPayloads } from "#lib/protocol/methods"
import type { ProtocolWindow } from "#lib/protocol/transport"

import { isRecord } from "#lib/is-record"

import { createSession } from "./session"

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

const launchWithoutInitData = "?tgWebAppPlatform=ios&tgWebAppVersion=9.6"

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

  it("replays every stateful event", () => {
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

  it("replays the last stateful payload to a late subscriber", () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      environment.emit("viewport_changed", {
        height: 640,
        width: 320,
        is_state_stable: true,
        is_expanded: false,
      })
      const received: unknown[] = []
      const unsubscribe = session.protocol.on("viewport_changed", (payload) => {
        received.push(payload)
      })

      expect(received).toEqual([
        { height: 640, width: 320, is_state_stable: true, is_expanded: false },
      ])

      unsubscribe()
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

  it("mounts the viewport and requests initial state on start", async () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      const started = session.start()
      await flushMicrotasks()

      expect(session.status.get()).toBe("launched")
      expect(environment.posts.map((post) => post.eventType)).toEqual([
        "web_app_request_theme",
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

      expect(
        environment.posts.filter((post) => post.eventType === "web_app_request_viewport"),
      ).toHaveLength(1)
      expect(session.status.get()).toBe("mounted")

      session.markReady()
      session.markReady()

      expect(session.status.get()).toBe("ready")
      expect(environment.posts.filter((post) => post.eventType === "web_app_ready")).toHaveLength(1)
      session.destroy()
    } finally {
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

  it("marks the session failed when mounting fails", async () => {
    const environment = installFakeWindow(launchWithoutInitData)
    try {
      const session = createSession()
      session.features.viewport.mount = async () => {
        await Promise.reject(new Error("mount failed"))
      }

      const mountFailure = await catchFailure(session.start())
      expect(mountFailure).toBeInstanceOf(Error)
      expect(mountFailure instanceof Error ? mountFailure.message : "").toContain("mount failed")

      expect(session.status.get()).toBe("failed")
      session.destroy()
    } finally {
      environment.restore()
    }
  })

  it("delivers an early viewport event to a session that starts with empty init data", async () => {
    const environment = installFakeWindow("?tgWebAppPlatform=web&tgWebAppVersion=9.6")
    try {
      const session = createSession()
      environment.emit("viewport_changed", {
        height: 640,
        width: 320,
        is_state_stable: true,
        is_expanded: true,
      })

      await session.start()

      expect(session.initData).toBeNull()
      expect(session.features.viewport.store.get()).toMatchObject({
        height: 640,
        width: 320,
        isExpanded: true,
      })
      session.destroy()
    } finally {
      environment.restore()
    }
  })
})
