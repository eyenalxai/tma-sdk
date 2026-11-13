/* oxlint-disable max-lines */
import { describe, expect, it, spyOn } from "bun:test"

import {
  createProtocol,
  invokeBestEffort,
  ProtocolTimeoutError,
  UnsupportedMethodError,
} from "./client"
import { createNativeWindow } from "./test-support"

const catchFailure = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("Expected the request to reject")
}

const trackSettlement = (promise: Promise<unknown>): (() => boolean) => {
  let isSettled = false
  const track = async (): Promise<void> => {
    try {
      await promise
    } catch {
      // The test observes settlement, and asserts the outcome separately.
    }
    isSettled = true
  }
  void track()
  return () => isSettled
}

describe("createProtocol invoke", () => {
  it("sends a method on a supported platform", () => {
    const { browserWindow, posts } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })

    protocol.invoke("web_app_setup_back_button", { is_visible: true })

    expect(posts).toEqual([
      { eventType: "web_app_setup_back_button", eventData: '{"is_visible":true}' },
    ])
    protocol.destroy()
  })

  it("sends a method whose declared version is older than the client reports", () => {
    const { browserWindow, posts } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "7.10", window: browserWindow })

    expect(protocol.supports("web_app_request_fullscreen")).toBe("unknown")
    protocol.invoke("web_app_request_fullscreen")

    expect(posts).toEqual([{ eventType: "web_app_request_fullscreen", eventData: '""' }])
    protocol.destroy()
  })

  it("rejects a method the platform does not implement", () => {
    const { browserWindow, posts } = createNativeWindow()
    const protocol = createProtocol({ platform: "webk", version: "9.0", window: browserWindow })

    expect(() => {
      protocol.invoke("web_app_request_viewport")
    }).toThrow(UnsupportedMethodError)
    expect(posts).toEqual([])
    protocol.destroy()
  })

  it("reports a best-effort failure without throwing", () => {
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({ platform: "webk", version: "9.0", window: browserWindow })
    const warn = spyOn(console, "warn").mockImplementation(() => undefined)

    expect(invokeBestEffort(protocol, "web_app_request_viewport")).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
    protocol.destroy()
  })
})

describe("createProtocol request", () => {
  it("uses the method table events and resolves with the first event", async () => {
    const { browserWindow, posts, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const pending = protocol.request({ method: ["web_app_request_viewport"] })

    expect(posts).toEqual([{ eventType: "web_app_request_viewport", eventData: '""' }])
    emit("viewport_changed", { height: 640, is_state_stable: true, is_expanded: false })

    expect(await pending).toEqual({
      event: "viewport_changed",
      payload: { height: 640, is_state_stable: true, is_expanded: false },
    })
    protocol.destroy()
  })

  it("carries the method, platform and version on a timeout", async () => {
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({
      platform: "ios",
      version: "9.6",
      window: browserWindow,
      defaultTimeout: 5,
    })

    const error = await catchFailure(protocol.request({ method: ["web_app_request_viewport"] }))

    expect(error).toBeInstanceOf(ProtocolTimeoutError)
    expect(error).toMatchObject({
      method: "web_app_request_viewport",
      platform: "ios",
      version: "9.6",
    })
    const message = error instanceof Error ? error.message : ""
    expect(message).toContain('Request "web_app_request_viewport"')
    expect(message).toContain("ios 9.6")
    protocol.destroy()
  })

  it("rejects an unsupported method instead of waiting for a timeout", async () => {
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({ platform: "webk", version: "9.0", window: browserWindow })

    const error = await catchFailure(protocol.request({ method: ["web_app_request_viewport"] }))

    expect(error).toBeInstanceOf(UnsupportedMethodError)
    protocol.destroy()
  })

  it("rejects pending requests on abort", async () => {
    const abortController = new AbortController()
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({
      platform: "ios",
      version: "9.6",
      window: browserWindow,
      signal: abortController.signal,
    })
    const pending = protocol.request({ method: ["web_app_request_viewport"] })

    abortController.abort()

    expect(await catchFailure(pending)).toMatchObject({
      message: 'Request "web_app_request_viewport" was aborted',
      name: "AbortError",
    })
    protocol.destroy()
  })

  it("subscribes before invoking so a synchronous reply is not lost", async () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    browserWindow.TelegramWebviewProxy = {
      postEvent: () => {
        emit("viewport_changed", { height: 1, is_state_stable: true, is_expanded: true })
      },
    }

    expect(await protocol.request({ method: ["web_app_request_viewport"] })).toMatchObject({
      event: "viewport_changed",
    })
    protocol.destroy()
  })

  it("ignores events that were not requested", async () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const pending = protocol.request({ method: ["web_app_request_viewport"] })

    emit("fullscreen_changed", { is_fullscreen: true })
    emit("viewport_changed", { height: 1, is_state_stable: true, is_expanded: true })

    expect(await pending).toMatchObject({ event: "viewport_changed" })
    protocol.destroy()
  })

  it("rejects with the posting error", async () => {
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const failure = new Error("boom")
    browserWindow.TelegramWebviewProxy = {
      postEvent: () => {
        throw failure
      },
    }

    expect(await catchFailure(protocol.request({ method: ["web_app_request_viewport"] }))).toBe(
      failure,
    )
    protocol.destroy()
  })

  it("wraps posting failures that are not errors", async () => {
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    browserWindow.TelegramWebviewProxy = {
      postEvent: () => {
        // oxlint-disable-next-line eslint/no-throw-literal, typescript/only-throw-error
        throw { reason: "unavailable" }
      },
    }

    expect(
      await catchFailure(protocol.request({ method: ["web_app_request_viewport"] })),
    ).toMatchObject({ message: "Unable to send Telegram event" })
    protocol.destroy()
  })

  it("removes its subscription after resolving", async () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const pending = protocol.request({ method: ["web_app_request_viewport"] })
    emit("viewport_changed", { height: 1, is_state_stable: true, is_expanded: true })
    await pending

    const error = spyOn(console, "error").mockImplementation(() => undefined)
    emit("viewport_changed", {})
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
    protocol.destroy()
  })

  it("removes its subscription after timing out", async () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({
      platform: "ios",
      version: "9.6",
      window: browserWindow,
      defaultTimeout: 5,
    })
    await catchFailure(protocol.request({ method: ["web_app_request_viewport"] }))

    const error = spyOn(console, "error").mockImplementation(() => undefined)
    emit("viewport_changed", {})
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
    protocol.destroy()
  })

  it("rejects immediately when the signal is already aborted", async () => {
    const abortController = new AbortController()
    abortController.abort()
    const { browserWindow, posts } = createNativeWindow()
    const protocol = createProtocol({
      platform: "ios",
      version: "9.6",
      window: browserWindow,
      signal: abortController.signal,
    })

    expect(
      await catchFailure(protocol.request({ method: ["web_app_request_viewport"] })),
    ).toMatchObject({
      message: 'Request "web_app_request_viewport" was aborted',
      name: "AbortError",
    })
    expect(posts).toEqual([])
    protocol.destroy()
  })

  it("rejects a request on a destroyed protocol", async () => {
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    protocol.destroy()

    expect(
      await catchFailure(protocol.request({ method: ["web_app_request_viewport"] })),
    ).toMatchObject({ message: "Cannot subscribe to a destroyed protocol" })
  })

  it("queues a second request for the same method behind the first", async () => {
    const { browserWindow, posts, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const first = protocol.request({ method: ["web_app_request_write_access"] })
    const second = protocol.request({ method: ["web_app_request_write_access"] })

    // Only the first call is on the wire; the second waits for its turn.
    expect(posts).toEqual([{ eventType: "web_app_request_write_access", eventData: '""' }])

    const isSecondSettled = trackSettlement(second)

    emit("write_access_requested", { status: "allowed" })
    expect(await first).toEqual({
      event: "write_access_requested",
      payload: { status: "allowed" },
    })
    await Promise.resolve()

    // One reply settles one request. The queued call starts on its own.
    expect(isSecondSettled()).toBe(false)
    expect(posts).toEqual([
      { eventType: "web_app_request_write_access", eventData: '""' },
      { eventType: "web_app_request_write_access", eventData: '""' },
    ])

    emit("write_access_requested", { status: "cancelled" })
    expect(await second).toEqual({
      event: "write_access_requested",
      payload: { status: "cancelled" },
    })
    protocol.destroy()
  })

  it("does not serialize requests for different methods", async () => {
    const { browserWindow, posts, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })

    const viewport = protocol.request({ method: ["web_app_request_viewport"] })
    const writeAccess = protocol.request({ method: ["web_app_request_write_access"] })

    expect(posts).toEqual([
      { eventType: "web_app_request_viewport", eventData: '""' },
      { eventType: "web_app_request_write_access", eventData: '""' },
    ])

    emit("viewport_changed", { height: 1, is_state_stable: true, is_expanded: true })
    emit("write_access_requested", { status: "allowed" })

    expect(await viewport).toMatchObject({ event: "viewport_changed" })
    expect(await writeAccess).toMatchObject({ event: "write_access_requested" })
    protocol.destroy()
  })

  it("releases the method gate after a timeout", async () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({
      platform: "ios",
      version: "9.6",
      window: browserWindow,
      defaultTimeout: 5,
    })
    const first = protocol.request({ method: ["web_app_request_viewport"] })
    const second = protocol.request({ method: ["web_app_request_viewport"] })

    expect(await catchFailure(first)).toBeInstanceOf(ProtocolTimeoutError)
    await Promise.resolve()

    emit("viewport_changed", { height: 320, is_state_stable: true, is_expanded: false })
    expect(await second).toEqual({
      event: "viewport_changed",
      payload: { height: 320, is_state_stable: true, is_expanded: false },
    })
    protocol.destroy()
  })

  it("ignores a reply whose req_id does not match the request", async () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const pending = protocol.request({
      method: ["web_app_read_text_from_clipboard", { req_id: "wanted" }],
      correlate: (result) => result.payload.req_id === "wanted",
    })

    emit("clipboard_text_received", { req_id: "other", data: "stale" })
    const isSettled = trackSettlement(pending)
    await Promise.resolve()
    expect(isSettled()).toBe(false)

    emit("clipboard_text_received", { req_id: "wanted", data: "fresh" })
    expect(await pending).toEqual({
      event: "clipboard_text_received",
      payload: { req_id: "wanted", data: "fresh" },
    })
    protocol.destroy()
  })

  it("releases the method gate after an aborted request", async () => {
    const abortController = new AbortController()
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({
      platform: "ios",
      version: "9.6",
      window: browserWindow,
      defaultTimeout: 100,
    })
    const first = protocol.request({
      method: ["web_app_request_write_access"],
      signal: abortController.signal,
    })
    const second = protocol.request({ method: ["web_app_request_write_access"] })

    abortController.abort()

    expect(await catchFailure(first)).toMatchObject({
      message: 'Request "web_app_request_write_access" was aborted',
      name: "AbortError",
    })
    await Promise.resolve()

    emit("write_access_requested", { status: "allowed" })
    expect(await second).toEqual({
      event: "write_access_requested",
      payload: { status: "allowed" },
    })
    protocol.destroy()
  })

  it("rejects a queued request when its signal aborts before its turn", async () => {
    const abortController = new AbortController()
    const { browserWindow, posts, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const first = protocol.request({ method: ["web_app_request_write_access"] })
    const second = protocol.request({
      method: ["web_app_request_write_access"],
      signal: abortController.signal,
    })

    abortController.abort()

    expect(await catchFailure(second)).toMatchObject({
      message: 'Request "web_app_request_write_access" was aborted',
      name: "AbortError",
    })
    expect(posts).toHaveLength(1)

    emit("write_access_requested", { status: "allowed" })
    expect(await first).toMatchObject({ event: "write_access_requested" })
    protocol.destroy()
  })

  it("validates the event list and the timeout", async () => {
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })

    expect(
      await catchFailure(protocol.request({ method: ["web_app_request_viewport"], events: [] })),
    ).toMatchObject({
      message: 'Request "web_app_request_viewport" must wait for at least one event',
    })
    expect(
      await catchFailure(protocol.request({ method: ["web_app_request_viewport"], timeout: -1 })),
    ).toMatchObject({ message: "Request timeout must be a non-negative finite number" })
    protocol.destroy()
  })
})

describe("createProtocol on", () => {
  it("delivers parsed payloads and stops after unsubscribe", () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const received: unknown[] = []
    const unsubscribe = protocol.on("back_button_pressed", (payload) => {
      received.push(payload)
    })

    emit("back_button_pressed", null)
    unsubscribe()
    emit("back_button_pressed", null)

    expect(received).toEqual([null])
    protocol.destroy()
  })

  it("ignores an invalid payload without throwing", () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const error = spyOn(console, "error").mockImplementation(() => undefined)
    const received: unknown[] = []
    protocol.on("content_safe_area_changed", (payload) => {
      received.push(payload)
    })

    emit("content_safe_area_changed", { top: 1 })

    expect(received).toEqual([])
    expect(error).toHaveBeenCalledTimes(1)
    error.mockRestore()
    protocol.destroy()
  })

  it("ignores unknown event types", () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const received: unknown[] = []
    protocol.on("back_button_pressed", () => {
      received.push("called")
    })

    emit("unknown_event", {})

    expect(received).toEqual([])
    protocol.destroy()
  })

  it("parses each event once per dispatch", () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const error = spyOn(console, "error").mockImplementation(() => undefined)
    const received: unknown[] = []
    protocol.on("content_safe_area_changed", () => {
      received.push("first")
    })
    protocol.on("content_safe_area_changed", () => {
      received.push("second")
    })

    emit("content_safe_area_changed", { top: 1 })

    expect(error).toHaveBeenCalledTimes(1)
    expect(received).toEqual([])
    error.mockRestore()
    protocol.destroy()
  })

  it("ignores events without handlers without parsing", () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const error = spyOn(console, "error").mockImplementation(() => undefined)

    emit("content_safe_area_changed", { top: 1 })

    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
    protocol.destroy()
  })

  it("propagates handler errors without logging them as parse failures", () => {
    const { browserWindow, emit } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const error = spyOn(console, "error").mockImplementation(() => undefined)
    const failure = new Error("handler failed")
    protocol.on("back_button_pressed", () => {
      throw failure
    })

    let caught: unknown = null
    try {
      emit("back_button_pressed", null)
    } catch (handlerError) {
      caught = handlerError
    }

    expect(caught).toBe(failure)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
    protocol.destroy()
  })

  it("refuses to invoke or subscribe after destroy", () => {
    const { browserWindow } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    protocol.destroy()

    expect(() => {
      protocol.invoke("web_app_ready")
    }).toThrow("Cannot invoke a method on a destroyed protocol")
    expect(() => {
      protocol.on("back_button_pressed", () => undefined)
    }).toThrow("Cannot subscribe to a destroyed protocol")
  })
})
