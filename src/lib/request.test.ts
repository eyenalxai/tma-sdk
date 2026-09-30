import { describe, expect, it, mock, spyOn } from "bun:test"

import type { TelegramEventSink } from "./event-bridge"
import type { RequestOptions } from "./request"

import { createEventHub } from "./event-hub"
import { createRequest } from "./request"

type Emit = (eventType: string, eventData?: unknown) => void

type HarnessOptions = {
  defaultTimeout?: number
  post?: (emit: Emit) => void
  signal?: AbortSignal
}

const createHarness = (options: HarnessOptions = {}) => {
  let sink: TelegramEventSink | null = null
  const hub = createEventHub((nextSink) => {
    sink = nextSink
    return () => {
      sink = null
    }
  })
  const emit: Emit = (eventType, eventData) => {
    sink?.(eventType, eventData)
  }
  const postEvent = mock(() => {
    options.post?.(emit)
  })
  const request = createRequest({
    hub,
    postEvent,
    signal: options.signal,
    defaultTimeout: options.defaultTimeout,
  })

  return { emit, hub, postEvent, request }
}

const catchFailure = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("Expected the request to reject")
}

const silentConsoleError = () =>
  spyOn(console, "error").mockImplementation(() => {
    // Expected parse failures are asserted through the spy.
  })

const viewportRequest: RequestOptions<"viewport_changed"> = {
  method: ["web_app_request_viewport"],
  events: ["viewport_changed"],
}

describe("createRequest", () => {
  it("resolves with the first requested event", async () => {
    const { emit, request } = createHarness()
    const pending = request(viewportRequest)

    emit("viewport_changed", { height: 640, is_state_stable: true, is_expanded: false })

    expect(await pending).toEqual({
      event: "viewport_changed",
      payload: { height: 640, is_state_stable: true, is_expanded: false },
    })
  })

  it("posts the method and waits for any of the requested events", async () => {
    const { emit, postEvent, request } = createHarness()
    const pending = request({
      method: ["web_app_request_fullscreen"],
      events: ["fullscreen_changed", "fullscreen_failed"],
    })

    expect(postEvent).toHaveBeenCalledWith("web_app_request_fullscreen")
    emit("fullscreen_failed", { error: "UNSUPPORTED" })

    expect(await pending).toEqual({
      event: "fullscreen_failed",
      payload: { error: "UNSUPPORTED" },
    })
  })

  it("subscribes before posting the method", async () => {
    const { request } = createHarness({
      post: (emit) => {
        emit("viewport_changed", { height: 1, is_state_stable: true, is_expanded: true })
      },
    })

    expect(await request(viewportRequest)).toMatchObject({ event: "viewport_changed" })
  })

  it("ignores events that were not requested", async () => {
    const { emit, request } = createHarness()
    const pending = request(viewportRequest)

    emit("fullscreen_changed", { is_fullscreen: true })
    emit("viewport_changed", { height: 1, is_state_stable: true, is_expanded: true })

    expect(await pending).toMatchObject({ event: "viewport_changed" })
  })

  it("rejects after the default timeout", async () => {
    const { request } = createHarness({ defaultTimeout: 5 })

    expect(await catchFailure(request(viewportRequest))).toMatchObject({
      message: 'Request "web_app_request_viewport" timed out waiting for events: viewport_changed',
    })
  })

  it("applies the request timeout over the default one", async () => {
    const { request } = createHarness({ defaultTimeout: 60_000 })

    expect(await catchFailure(request({ ...viewportRequest, timeout: 5 }))).toMatchObject({
      message: 'Request "web_app_request_viewport" timed out waiting for events: viewport_changed',
    })
  })

  it("rejects pending requests on abort", async () => {
    const abortController = new AbortController()
    const { request } = createHarness({ signal: abortController.signal })
    const pending = request(viewportRequest)

    abortController.abort()

    expect(await catchFailure(pending)).toMatchObject({
      message: 'Request "web_app_request_viewport" was aborted',
      name: "AbortError",
    })
  })

  it("rejects immediately when the signal is already aborted", async () => {
    const abortController = new AbortController()
    abortController.abort()
    const { postEvent, request } = createHarness({ signal: abortController.signal })

    expect(await catchFailure(request(viewportRequest))).toMatchObject({
      message: 'Request "web_app_request_viewport" was aborted',
      name: "AbortError",
    })
    expect(postEvent).not.toHaveBeenCalled()
  })

  it("validates that at least one event is requested", async () => {
    const { request } = createHarness()

    expect(
      await catchFailure(request({ method: ["web_app_request_viewport"], events: [] })),
    ).toMatchObject({
      message: 'Request "web_app_request_viewport" must wait for at least one event',
    })
  })

  it("validates the timeout", async () => {
    const { request } = createHarness()

    expect(await catchFailure(request({ ...viewportRequest, timeout: -1 }))).toMatchObject({
      message: "Request timeout must be a non-negative finite number",
    })
    expect(await catchFailure(request({ ...viewportRequest, timeout: Number.NaN }))).toMatchObject({
      message: "Request timeout must be a non-negative finite number",
    })
  })

  it("rejects with the posting error", async () => {
    const failure = new Error("boom")
    const { request } = createHarness({
      post: () => {
        throw failure
      },
    })

    expect(await catchFailure(request(viewportRequest))).toBe(failure)
  })

  it("wraps posting failures that are not errors", async () => {
    const failure: unknown = { reason: "unavailable" }
    const { request } = createHarness({
      post: () => {
        throw failure
      },
    })

    expect(await catchFailure(request(viewportRequest))).toMatchObject({
      message: "Unable to post Telegram event",
    })
  })

  it("removes its subscription after resolving", async () => {
    const consoleError = silentConsoleError()
    const { emit, request } = createHarness()
    const pending = request(viewportRequest)
    emit("viewport_changed", { height: 1, is_state_stable: true, is_expanded: true })
    await pending

    emit("viewport_changed", {})

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("removes its subscription after timing out", async () => {
    const consoleError = silentConsoleError()
    const { emit, request } = createHarness({ defaultTimeout: 5 })
    await catchFailure(request(viewportRequest))

    emit("viewport_changed", {})

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("releases its timeout when subscribing to the hub fails", async () => {
    const clearTimeoutSpy = spyOn(globalThis, "clearTimeout")
    const { hub, request } = createHarness()
    hub.destroy()

    expect(await catchFailure(request(viewportRequest))).toMatchObject({
      message: "Cannot subscribe to a destroyed event hub",
    })
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    clearTimeoutSpy.mockRestore()
  })
})
