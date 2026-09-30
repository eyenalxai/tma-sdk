import { describe, expect, it, spyOn } from "bun:test"

import type { TelegramEventSink } from "./event-bridge"

import { createEventHub } from "./event-hub"

const createTestBridge = () => {
  let sink: TelegramEventSink | null = null

  const subscribe = (nextSink: TelegramEventSink): (() => void) => {
    sink = nextSink
    return () => {
      sink = null
    }
  }

  return {
    emit: (eventType: string, eventData?: unknown): void => {
      sink?.(eventType, eventData)
    },
    isSubscribed: (): boolean => sink !== null,
    subscribe,
  }
}

const silentConsoleError = () =>
  spyOn(console, "error").mockImplementation(() => {
    // Expected parse failures are asserted through the spy.
  })

describe("createEventHub", () => {
  it("delivers parsed payloads to registered handlers", () => {
    const bridge = createTestBridge()
    const hub = createEventHub(bridge.subscribe)
    const received: unknown[] = []
    hub.on("viewport_changed", (payload) => {
      received.push(payload)
    })

    bridge.emit("viewport_changed", {
      height: 640,
      is_state_stable: true,
      is_expanded: false,
    })

    expect(received).toEqual([{ height: 640, is_state_stable: true, is_expanded: false }])
  })

  it("parses each event once per dispatch", () => {
    const bridge = createTestBridge()
    const hub = createEventHub(bridge.subscribe)
    const consoleError = silentConsoleError()
    const received: unknown[] = []
    hub.on("back_button_pressed", () => {
      received.push("first")
    })
    hub.on("back_button_pressed", () => {
      received.push("second")
    })

    bridge.emit("back_button_pressed", {})

    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(received).toEqual([])
    consoleError.mockRestore()
  })

  it("ignores events without handlers without parsing", () => {
    const bridge = createTestBridge()
    const hub = createEventHub(bridge.subscribe)
    const consoleError = silentConsoleError()
    const received: unknown[] = []
    hub.on("back_button_pressed", () => {
      received.push("called")
    })

    bridge.emit("fullscreen_changed", {})

    expect(received).toEqual([])
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("ignores unknown event types", () => {
    const bridge = createTestBridge()
    const hub = createEventHub(bridge.subscribe)
    const received: unknown[] = []
    hub.on("back_button_pressed", () => {
      received.push("called")
    })

    bridge.emit("unknown_event", {})

    expect(received).toEqual([])
  })

  it("stops delivering to an unsubscribed handler", () => {
    const bridge = createTestBridge()
    const hub = createEventHub(bridge.subscribe)
    const received: unknown[] = []
    const unsubscribe = hub.on("back_button_pressed", () => {
      received.push("called")
    })

    bridge.emit("back_button_pressed", null)
    unsubscribe()
    bridge.emit("back_button_pressed", null)

    expect(received).toEqual(["called"])
  })

  it("unsubscribes from the bridge and clears handlers on destroy", () => {
    const bridge = createTestBridge()
    const hub = createEventHub(bridge.subscribe)
    const received: unknown[] = []
    hub.on("back_button_pressed", () => {
      received.push("called")
    })

    expect(bridge.isSubscribed()).toBe(true)
    hub.destroy()
    expect(bridge.isSubscribed()).toBe(false)
    bridge.emit("back_button_pressed", null)
    expect(received).toEqual([])
  })

  it("rejects subscriptions after destroy", () => {
    const bridge = createTestBridge()
    const hub = createEventHub(bridge.subscribe)
    const received: unknown[] = []
    hub.destroy()

    expect(() =>
      hub.on("back_button_pressed", () => {
        received.push("called")
      }),
    ).toThrow("Cannot subscribe to a destroyed event hub")
    expect(received).toEqual([])
  })
})
