import { z } from "zod"

import { isRecord } from "./is-record"
import { TELEGRAM_WEB_ORIGIN } from "./post-event"

const safeAreaInsetsSchema = z.looseObject({
  top: z.number(),
  bottom: z.number(),
  left: z.number(),
  right: z.number(),
})

const payloadlessEventSchema = z.null().default(null)

const viewportChangedEventSchema = z
  .looseObject({
    height: z.number(),
    width: z.number().optional(),
    is_state_stable: z.boolean(),
    is_expanded: z.boolean(),
  })
  .nullable()
  .transform(
    (value) =>
      value ?? {
        height: window.innerHeight,
        width: window.innerWidth,
        is_state_stable: true,
        is_expanded: true,
      },
  )

/**
 * Payload schemas for the Mini Apps events used by this package.
 * @see https://core.telegram.org/bots/webapps#events-available-for-mini-apps
 */
const eventSchemas = {
  back_button_pressed: payloadlessEventSchema,
  content_safe_area_changed: safeAreaInsetsSchema,
  file_download_requested: z.looseObject({ status: z.enum(["cancelled", "downloading"]) }),
  fullscreen_changed: z.looseObject({ is_fullscreen: z.boolean() }),
  fullscreen_failed: z.looseObject({ error: z.string() }),
  reload_iframe: payloadlessEventSchema,
  safe_area_changed: safeAreaInsetsSchema,
  set_custom_style: z.string(),
  // MacOS Telegram has a bug sending a null payload; fall back to window dimensions.
  viewport_changed: viewportChangedEventSchema,
  write_access_requested: z.looseObject({ status: z.enum(["allowed", "cancelled"]) }),
}

type SafeAreaInsets = z.output<typeof safeAreaInsetsSchema>
type ViewportChangedEvent = z.output<typeof viewportChangedEventSchema>
type TelegramEventName = keyof typeof eventSchemas
type TelegramEventPayloads = {
  [Event in TelegramEventName]: z.output<(typeof eventSchemas)[Event]>
}

const messageSchema = z.looseObject({
  eventType: z.string(),
  eventData: z.unknown().optional(),
})

type Handler = (eventData: unknown) => void
type RegisterCleanup = (cleanup: () => void) => void

const handlers = new Map<string, Set<Handler>>()
let uninstallBridge: (() => void) | null = null

const tryParseJson = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function parseEventPayload<Event extends TelegramEventName>(
  event: Event,
  eventData?: unknown,
): TelegramEventPayloads[Event]
function parseEventPayload(
  event: TelegramEventName,
  eventData?: unknown,
): TelegramEventPayloads[TelegramEventName] {
  return eventSchemas[event].parse(tryParseJson(eventData))
}

const dispatch = (eventType: string, eventData: unknown): void => {
  const eventHandlers = handlers.get(eventType)
  if (eventHandlers === undefined || eventHandlers.size === 0) {
    return
  }

  for (const handler of eventHandlers) {
    handler(eventData)
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

/** Installs a global `receiveEvent` entry point used by native Telegram clients. */
const installReceiveEvent = (
  owner: Record<PropertyKey, unknown>,
  key: string,
  registerCleanup: RegisterCleanup,
): void => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(owner, key)
  const receiveEvent = (eventType: string, eventData?: unknown) => {
    dispatch(eventType, eventData)
  }
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
  const cleanups: (() => void)[] = []
  const registerCleanup: RegisterCleanup = (cleanup) => {
    cleanups.push(cleanup)
  }
  const uninstall = () => {
    for (const cleanup of cleanups.splice(0).toReversed()) {
      cleanup()
    }
  }

  try {
    const gameProxy = ensureRecord(browserWindow, "TelegramGameProxy", registerCleanup)
    const telegram = ensureRecord(browserWindow, "Telegram", registerCleanup)
    const webView = ensureRecord(telegram, "WebView", registerCleanup)
    installReceiveEvent(browserWindow, "TelegramGameProxy_receiveEvent", registerCleanup)
    installReceiveEvent(gameProxy, "receiveEvent", registerCleanup)
    installReceiveEvent(webView, "receiveEvent", registerCleanup)

    window.addEventListener("message", handleWindowMessage)
    registerCleanup(() => {
      window.removeEventListener("message", handleWindowMessage)
    })
  } catch (error) {
    uninstall()
    throw error
  }

  return uninstall
}

/**
 * Subscribes to a Mini Apps event sent from the Telegram client.
 * @returns Function removing the listener.
 */
const on = <E extends TelegramEventName>(
  event: E,
  handler: (payload: TelegramEventPayloads[E]) => void,
): (() => void) => {
  if (handlers.size === 0) {
    uninstallBridge = installTelegramEventBridge()
  }

  let eventHandlers = handlers.get(event)
  if (eventHandlers === undefined) {
    eventHandlers = new Set()
    handlers.set(event, eventHandlers)
  }
  const handleEvent: Handler = (eventData) => {
    const result = (() => {
      try {
        return { success: true as const, payload: parseEventPayload(event, eventData) }
      } catch (error) {
        return { success: false as const, error }
      }
    })()
    if (!result.success) {
      console.error(`[Telegram] Failed to parse "${event}" event payload`, eventData, result.error)
      return
    }
    handler(result.payload)
  }
  eventHandlers.add(handleEvent)

  return () => {
    eventHandlers.delete(handleEvent)
    if (eventHandlers.size === 0) {
      handlers.delete(event)
    }
    if (handlers.size === 0) {
      uninstallBridge?.()
      uninstallBridge = null
    }
  }
}

export {
  on,
  parseEventPayload,
  type SafeAreaInsets,
  type TelegramEventName,
  type TelegramEventPayloads,
  type ViewportChangedEvent,
}
