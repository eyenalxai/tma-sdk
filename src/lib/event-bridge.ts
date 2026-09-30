import { z } from "zod"

import { createDisposer } from "./disposer"
import { tryParseJson } from "./event-schemas"
import { isRecord } from "./is-record"
import { TELEGRAM_WEB_ORIGIN } from "./post-event"

type TelegramEventSink = (eventType: string, eventData?: unknown) => void

type RegisterCleanup = (cleanup: () => void) => void

const messageSchema = z.looseObject({
  eventType: z.string(),
  eventData: z.unknown().optional(),
})

const sinks = new Set<TelegramEventSink>()
let uninstallBridge: (() => void) | null = null

const dispatch = (eventType: string, eventData?: unknown): void => {
  for (const sink of sinks) {
    sink(eventType, eventData)
  }
}

const handleWindowMessage = (event: MessageEvent): void => {
  // Ignore messages not coming from the parent window.
  if (
    event.source !== window.parent ||
    event.origin !== TELEGRAM_WEB_ORIGIN ||
    typeof event.data !== "string"
  ) {
    return
  }

  const result = messageSchema.safeParse(tryParseJson(event.data))
  if (!result.success) {
    return
  }

  dispatch(result.data.eventType, result.data.eventData)
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

const receiveEvent = (eventType: string, eventData?: unknown): void => {
  dispatch(eventType, eventData)
}

/** Installs a global `receiveEvent` entry point used by native Telegram clients. */
const installReceiveEvent = (
  owner: Record<PropertyKey, unknown>,
  key: string,
  registerCleanup: RegisterCleanup,
): void => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(owner, key)
  owner[key] = receiveEvent

  registerCleanup(() => {
    if (owner[key] === receiveEvent) {
      restoreProperty(owner, key, previousDescriptor)
    }
  })
}

const ensureRecord = (
  owner: Record<PropertyKey, unknown>,
  key: string,
  registerCleanup: RegisterCleanup,
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

const installTelegramEventBridge = (): (() => void) => {
  const browserWindow: unknown = window
  if (!isRecord(browserWindow)) {
    throw new Error("Unable to wire Telegram events")
  }

  const disposer = createDisposer()

  try {
    const gameProxy = ensureRecord(browserWindow, "TelegramGameProxy", disposer.add)
    const telegram = ensureRecord(browserWindow, "Telegram", disposer.add)
    const webView = ensureRecord(telegram, "WebView", disposer.add)
    installReceiveEvent(browserWindow, "TelegramGameProxy_receiveEvent", disposer.add)
    installReceiveEvent(gameProxy, "receiveEvent", disposer.add)
    installReceiveEvent(webView, "receiveEvent", disposer.add)

    window.addEventListener("message", handleWindowMessage)
    disposer.add(() => {
      window.removeEventListener("message", handleWindowMessage)
    })
  } catch (error) {
    disposer.dispose()
    throw error
  }

  return () => {
    disposer.dispose()
  }
}

/**
 * Subscribes to raw Mini Apps events sent from the Telegram client.
 * The first subscriber installs the global bridge, the last one removes it.
 * @returns Function removing the sink.
 */
const subscribeToTelegramEvents = (sink: TelegramEventSink): (() => void) => {
  if (sinks.size === 0) {
    uninstallBridge = installTelegramEventBridge()
  }
  sinks.add(sink)

  return () => {
    sinks.delete(sink)
    if (sinks.size === 0) {
      uninstallBridge?.()
      uninstallBridge = null
    }
  }
}

export { subscribeToTelegramEvents, type TelegramEventSink }
