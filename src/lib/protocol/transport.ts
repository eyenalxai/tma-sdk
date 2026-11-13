import { createDisposer } from "#lib/disposer"
import { isRecord } from "#lib/is-record"

import type { WireMessage } from "./codec"

type ProtocolWindow = Record<PropertyKey, unknown>

type PostEventProxy = { postEvent: (eventType: string, eventData: string) => void }
type NotifyProxy = { notify: (message: string) => void }
type MessageTarget = { postMessage: (message: string, targetOrigin: string) => void }

type Transport = {
  readonly isFramed: boolean
  readonly targetOrigin: string | null
  send: (message: WireMessage) => void
}

type TelegramEventSink = (eventType: string, eventData?: unknown) => void

const TELEGRAM_WEB_ORIGINS = new Set(["https://web.telegram.org", "https://webk.telegram.org"])

const isPostEventProxy = (value: unknown): value is PostEventProxy =>
  isRecord(value) && typeof value.postEvent === "function"

const isNotifyProxy = (value: unknown): value is NotifyProxy =>
  isRecord(value) && typeof value.notify === "function"

const isMessageTarget = (value: unknown): value is MessageTarget =>
  isRecord(value) && typeof value.postMessage === "function"

const getBrowserWindow = (): ProtocolWindow => {
  const browserWindow: unknown = globalThis.window
  if (!isRecord(browserWindow)) {
    throw new Error("Unable to use the Telegram protocol outside a browser environment")
  }
  return browserWindow
}

const isIframe = (browserWindow: ProtocolWindow): boolean => {
  try {
    return browserWindow.parent !== undefined && browserWindow.parent !== browserWindow
  } catch {
    return true
  }
}

const readAncestorOrigin = (browserWindow: ProtocolWindow): string | null => {
  const location = browserWindow.location
  if (!isRecord(location)) {
    return null
  }
  const ancestors = location.ancestorOrigins
  if (!isRecord(ancestors)) {
    return null
  }
  const first = ancestors[0]
  return typeof first === "string" ? first : null
}

const readReferrer = (browserWindow: ProtocolWindow): string | null => {
  const document = browserWindow.document
  if (!isRecord(document)) {
    return null
  }
  return typeof document.referrer === "string" ? document.referrer : null
}

const parseOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Returns the first origin the page knows: the parent origin when the browser
 * exposes it, otherwise the referrer. `null` means neither is available.
 */
const readPresentOrigin = (browserWindow: ProtocolWindow): string | null => {
  const ancestorOrigin = readAncestorOrigin(browserWindow)
  if (ancestorOrigin !== null && ancestorOrigin !== "") {
    return ancestorOrigin
  }
  const referrer = readReferrer(browserWindow)
  if (referrer !== null && referrer !== "") {
    return referrer
  }
  return null
}

/**
 * The iframe target is one of the allowlisted Telegram Web origins. A page that
 * exposes a different origin is refused instead of falling back to `*`; the
 * wildcard is only for pages where neither the ancestor nor the referrer is
 * available.
 */
const resolveTargetOrigin = (browserWindow: ProtocolWindow): string => {
  const candidate = readPresentOrigin(browserWindow)
  if (candidate === null) {
    return "*"
  }
  const origin = parseOrigin(candidate)
  if (origin !== null && TELEGRAM_WEB_ORIGINS.has(origin)) {
    return origin
  }
  throw new Error(
    `Unable to send Telegram events: "${candidate}" is not an allowlisted Telegram Web origin`,
  )
}

/**
 * Web K launch parameters report the platform as `web`, so the host is the only
 * reliable signal. It is served from `webk.telegram.org`, not `web.telegram.org`.
 */
const isWebKWindow = (browserWindow: ProtocolWindow): boolean => {
  const candidate = readPresentOrigin(browserWindow)
  if (candidate === null) {
    return false
  }
  return parseOrigin(candidate) === "https://webk.telegram.org"
}

const getParentTarget = (browserWindow: ProtocolWindow): MessageTarget => {
  const parent = browserWindow.parent
  if (!isMessageTarget(parent)) {
    throw new Error("Unable to send Telegram event: the parent window is unavailable")
  }
  return parent
}

const createTransport = (browserWindow: ProtocolWindow = getBrowserWindow()): Transport => {
  const isFramed = isIframe(browserWindow)
  const targetOrigin = isFramed ? resolveTargetOrigin(browserWindow) : null

  return {
    isFramed,
    targetOrigin,
    send: (message) => {
      const proxy = browserWindow.TelegramWebviewProxy
      if (isPostEventProxy(proxy)) {
        proxy.postEvent(message.eventType, message.nativePayload)
        return
      }

      const external = browserWindow.external
      if (isNotifyProxy(external)) {
        external.notify(
          JSON.stringify({ eventType: message.eventType, eventData: message.eventData }),
        )
        return
      }

      if (isIframe(browserWindow)) {
        getParentTarget(browserWindow).postMessage(
          JSON.stringify({ eventType: message.eventType, eventData: message.eventData }),
          targetOrigin ?? "*",
        )
        return
      }

      throw new Error(
        `Unable to send Telegram event "${message.eventType}": no transport available`,
      )
    },
  }
}

const restoreProperty = (
  owner: Record<PropertyKey, unknown>,
  key: string,
  descriptor: PropertyDescriptor | undefined,
): void => {
  if (descriptor === undefined) {
    Reflect.deleteProperty(owner, key)
  } else {
    Object.defineProperty(owner, key, descriptor)
  }
}

const ensureRecord = (
  owner: Record<PropertyKey, unknown>,
  key: string,
  registerCleanup: (cleanup: () => void) => void,
): Record<PropertyKey, unknown> => {
  const current = owner[key]
  if (isRecord(current)) {
    return current
  }

  const previousDescriptor = Object.getOwnPropertyDescriptor(owner, key)
  const created: Record<PropertyKey, unknown> = {}
  owner[key] = created
  registerCleanup(() => {
    if (owner[key] === created && Reflect.ownKeys(created).length === 0) {
      restoreProperty(owner, key, previousDescriptor)
    }
  })
  return created
}

const installReceiveEvent = (
  owner: Record<PropertyKey, unknown>,
  key: string,
  receive: TelegramEventSink,
  registerCleanup: (cleanup: () => void) => void,
): void => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(owner, key)
  owner[key] = receive

  registerCleanup(() => {
    if (owner[key] === receive) {
      restoreProperty(owner, key, previousDescriptor)
    }
  })
}

const readParentMessage = (
  event: MessageEvent,
  browserWindow: ProtocolWindow,
  targetOrigin: string | null,
): { eventType: string; eventData: unknown } | null => {
  if (event.source !== browserWindow.parent || typeof event.data !== "string") {
    return null
  }
  if (targetOrigin !== null && targetOrigin !== "*" && event.origin !== targetOrigin) {
    return null
  }

  let parsed: unknown = null
  try {
    parsed = JSON.parse(event.data) as unknown
  } catch {
    return null
  }
  if (!isRecord(parsed) || typeof parsed.eventType !== "string") {
    return null
  }

  return { eventType: parsed.eventType, eventData: parsed.eventData }
}

/**
 * Installs the three globals native clients call and the parent message
 * listener Telegram Web uses. All four feed the same sink.
 */
const installInboundBridge = (
  browserWindow: ProtocolWindow,
  receive: TelegramEventSink,
  targetOrigin: string | null,
): (() => void) => {
  const disposer = createDisposer()

  try {
    const gameProxy = ensureRecord(browserWindow, "TelegramGameProxy", disposer.add)
    const telegram = ensureRecord(browserWindow, "Telegram", disposer.add)
    const webView = ensureRecord(telegram, "WebView", disposer.add)
    installReceiveEvent(browserWindow, "TelegramGameProxy_receiveEvent", receive, disposer.add)
    installReceiveEvent(gameProxy, "receiveEvent", receive, disposer.add)
    installReceiveEvent(webView, "receiveEvent", receive, disposer.add)

    const addEventListener = browserWindow.addEventListener
    if (typeof addEventListener === "function") {
      const listener = (event: MessageEvent): void => {
        const message = readParentMessage(event, browserWindow, targetOrigin)
        if (message !== null) {
          receive(message.eventType, message.eventData)
        }
      }
      addEventListener.call(browserWindow, "message", listener)
      disposer.add(() => {
        const removeEventListener = browserWindow.removeEventListener
        if (typeof removeEventListener === "function") {
          removeEventListener.call(browserWindow, "message", listener)
        }
      })
    }
  } catch (error) {
    disposer.dispose()
    throw error
  }

  return () => {
    disposer.dispose()
  }
}

export {
  createTransport,
  getBrowserWindow,
  installInboundBridge,
  isWebKWindow,
  type ProtocolWindow,
  type TelegramEventSink,
}
