import { describe, expect, it } from "bun:test"

import { createProtocol } from "./client"
import { createTransport } from "./transport"

type NativePost = { eventType: string; eventData: string }

const createNativeWindow = () => {
  const posts: NativePost[] = []
  const browserWindow: Record<PropertyKey, unknown> = {
    TelegramWebviewProxy: {
      postEvent: (eventType: string, eventData: string) => {
        posts.push({ eventType, eventData })
      },
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  browserWindow.self = browserWindow
  browserWindow.top = browserWindow
  browserWindow.parent = browserWindow
  return { browserWindow, posts }
}

type IframeWindowOptions = {
  ancestorOrigin?: string | null
  referrer?: string
}

const createIframeWindow = (options: IframeWindowOptions = {}) => {
  const messages: { message: string; targetOrigin: string }[] = []
  const listeners = new Set<(event: MessageEvent) => void>()
  const parent: Record<PropertyKey, unknown> = {
    postMessage: (message: string, targetOrigin: string) => {
      messages.push({ message, targetOrigin })
    },
  }
  const ancestorOrigin = options.ancestorOrigin
  const browserWindow: Record<PropertyKey, unknown> = {
    parent,
    top: parent,
    addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
      if (type === "message") {
        listeners.add(listener)
      }
    },
    removeEventListener: (type: string, listener: (event: MessageEvent) => void) => {
      if (type === "message") {
        listeners.delete(listener)
      }
    },
    location: {
      ancestorOrigins:
        ancestorOrigin === undefined || ancestorOrigin === null ? [] : [ancestorOrigin],
    },
    document: { referrer: options.referrer ?? "" },
  }
  browserWindow.self = browserWindow

  return {
    browserWindow,
    messages,
    parent,
    dispatch: (event: MessageEvent) => {
      for (const listener of listeners) {
        listener(event)
      }
    },
    listenerCount: () => listeners.size,
  }
}

const parentMessage = (source: unknown, data: unknown, origin: string): MessageEvent => {
  const message = {
    data: typeof data === "string" ? data : JSON.stringify(data),
    origin,
    source,
  }
  return message as MessageEvent
}

const readWireMessage = (message: string): unknown => JSON.parse(message) as unknown

describe("transport", () => {
  it("routes invoke through a native proxy and delivers events from all three globals", () => {
    const { browserWindow, posts } = createNativeWindow()
    const protocol = createProtocol({ platform: "ios", version: "9.6", window: browserWindow })
    const received: unknown[] = []
    protocol.on("back_button_pressed", (payload) => {
      received.push(payload)
    })

    protocol.invoke("web_app_ready")

    expect(posts).toEqual([{ eventType: "web_app_ready", eventData: '""' }])

    const gameProxy = browserWindow.TelegramGameProxy as {
      receiveEvent: (eventType: string, eventData?: unknown) => void
    }
    const webView = (browserWindow.Telegram as { WebView: Record<string, unknown> }).WebView
    const receiveGlobal = browserWindow.TelegramGameProxy_receiveEvent as (
      eventType: string,
      eventData?: unknown,
    ) => void
    const receiveWebView = webView.receiveEvent as (eventType: string, eventData?: unknown) => void

    receiveGlobal("back_button_pressed", null)
    gameProxy.receiveEvent("back_button_pressed", null)
    receiveWebView("back_button_pressed", null)

    expect(received).toEqual([null, null, null])
    expect(protocol.isFramed).toBe(false)
    protocol.destroy()
  })

  it("prefers the native proxy over the external channel and the iframe", () => {
    const { browserWindow, messages } = createIframeWindow({
      ancestorOrigin: "https://web.telegram.org",
    })
    const posts: NativePost[] = []
    const notified: string[] = []
    browserWindow.TelegramWebviewProxy = {
      postEvent: (eventType: string, eventData: string) => {
        posts.push({ eventType, eventData })
      },
    }
    browserWindow.external = {
      notify: (message: string) => {
        notified.push(message)
      },
    }

    createTransport(browserWindow).send({
      eventType: "web_app_ready",
      eventData: "",
      nativePayload: '""',
    })

    expect(posts).toEqual([{ eventType: "web_app_ready", eventData: '""' }])
    expect(notified).toEqual([])
    expect(messages).toEqual([])
  })

  it("prefers window.external.notify over the iframe", () => {
    const { browserWindow, messages } = createIframeWindow({
      ancestorOrigin: "https://web.telegram.org",
    })
    const notified: string[] = []
    browserWindow.external = {
      notify: (message: string) => {
        notified.push(message)
      },
    }

    createTransport(browserWindow).send({
      eventType: "web_app_ready",
      eventData: "",
      nativePayload: '""',
    })

    expect(notified).toEqual(['{"eventType":"web_app_ready","eventData":""}'])
    expect(messages).toEqual([])
  })

  it("uses the referrer when ancestor origins are unavailable", () => {
    const { browserWindow, messages } = createIframeWindow({
      referrer: "https://web.telegram.org/",
    })

    createTransport(browserWindow).send({
      eventType: "web_app_ready",
      eventData: "",
      nativePayload: '""',
    })

    expect(messages).toEqual([
      {
        message: '{"eventType":"web_app_ready","eventData":""}',
        targetOrigin: "https://web.telegram.org",
      },
    ])
  })

  it("uses the Web K ancestor origin and accepts parent events from it", () => {
    const { browserWindow, messages, parent, dispatch } = createIframeWindow({
      ancestorOrigin: "https://webk.telegram.org",
    })
    const protocol = createProtocol({ platform: "webk", version: "9.0", window: browserWindow })
    const received: unknown[] = []
    protocol.on("viewport_changed", (payload) => {
      received.push(payload)
    })

    protocol.invoke("web_app_ready")

    expect(messages).toEqual([
      {
        message: '{"eventType":"web_app_ready","eventData":""}',
        targetOrigin: "https://webk.telegram.org",
      },
    ])
    expect(readWireMessage(messages[0]?.message ?? "")).toEqual({
      eventType: "web_app_ready",
      eventData: "",
    })

    dispatch(
      parentMessage(
        parent,
        {
          eventType: "viewport_changed",
          eventData: { height: 640, is_state_stable: true, is_expanded: true },
        },
        "https://webk.telegram.org",
      ),
    )

    expect(received).toEqual([{ height: 640, is_state_stable: true, is_expanded: true }])
    protocol.destroy()
  })

  it("falls back to * only with a source check", () => {
    const { browserWindow, messages, parent, dispatch } = createIframeWindow()
    const protocol = createProtocol({ platform: "web", version: "9.0", window: browserWindow })
    const received: unknown[] = []
    protocol.on("back_button_pressed", (payload) => {
      received.push(payload)
    })

    protocol.invoke("web_app_ready")
    expect(messages[0]?.targetOrigin).toBe("*")

    dispatch(
      parentMessage(
        {},
        { eventType: "back_button_pressed", eventData: null },
        "https://evil.example",
      ),
    )
    expect(received).toEqual([])

    dispatch(
      parentMessage(
        parent,
        { eventType: "back_button_pressed", eventData: null },
        "https://evil.example",
      ),
    )
    expect(received).toEqual([null])
    protocol.destroy()
  })

  it("rejects a parent event from another origin when the target origin is known", () => {
    const { browserWindow, parent, dispatch } = createIframeWindow({
      ancestorOrigin: "https://web.telegram.org",
    })
    const protocol = createProtocol({ platform: "web", version: "9.0", window: browserWindow })
    const received: unknown[] = []
    protocol.on("back_button_pressed", () => {
      received.push("called")
    })

    dispatch(
      parentMessage(
        parent,
        { eventType: "back_button_pressed", eventData: null },
        "https://evil.example",
      ),
    )
    expect(received).toEqual([])

    dispatch(
      parentMessage(
        parent,
        { eventType: "back_button_pressed", eventData: null },
        "https://web.telegram.org",
      ),
    )
    expect(received).toEqual(["called"])
    protocol.destroy()
  })

  it("removes the receive globals and the message listener on destroy", () => {
    const { browserWindow, listenerCount } = createIframeWindow({
      ancestorOrigin: "https://web.telegram.org",
    })
    const protocol = createProtocol({ platform: "web", version: "9.0", window: browserWindow })
    const testWindow = browserWindow

    expect(testWindow.TelegramGameProxy_receiveEvent).toBeDefined()
    expect(testWindow.TelegramGameProxy).toBeDefined()
    expect(listenerCount()).toBe(1)

    protocol.destroy()

    expect(testWindow.TelegramGameProxy_receiveEvent).toBeUndefined()
    expect(testWindow.TelegramGameProxy).toBeUndefined()
    expect(listenerCount()).toBe(0)
  })
})
