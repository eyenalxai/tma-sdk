import type { TelegramEventSink } from "./event-bridge"
import type { TelegramEventName, TelegramEventPayloads } from "./event-schemas"

import { subscribeToTelegramEvents } from "./event-bridge"
import { eventSchemas, parseEventPayload } from "./event-schemas"

type EventHub = {
  on: <E extends TelegramEventName>(
    event: E,
    handler: (payload: TelegramEventPayloads[E]) => void,
  ) => () => void
  destroy: () => void
}

type EventHandler<Event extends TelegramEventName> = (payload: TelegramEventPayloads[Event]) => void

type EventHandlerSets = {
  [Event in TelegramEventName]: Set<EventHandler<Event>>
}

type EventPayloadParseResult =
  | { success: true; payload: TelegramEventPayloads[TelegramEventName] }
  | { success: false }

const isTelegramEventName = (value: string): value is TelegramEventName =>
  Object.hasOwn(eventSchemas, value)

const parseEventPayloadOrLog = (
  eventType: TelegramEventName,
  eventData: unknown,
): EventPayloadParseResult => {
  try {
    return { success: true, payload: parseEventPayload(eventType, eventData) }
  } catch (error) {
    console.error(`[Telegram] Failed to parse "${eventType}" event payload`, eventData, error)
    return { success: false }
  }
}

const createEventHub = (
  subscribe: (sink: TelegramEventSink) => () => void = subscribeToTelegramEvents,
): EventHub => {
  const handlerSets: EventHandlerSets = {
    back_button_pressed: new Set(),
    content_safe_area_changed: new Set(),
    file_download_requested: new Set(),
    fullscreen_changed: new Set(),
    fullscreen_failed: new Set(),
    reload_iframe: new Set(),
    safe_area_changed: new Set(),
    set_custom_style: new Set(),
    viewport_changed: new Set(),
    write_access_requested: new Set(),
  }
  let isDestroyed = false

  const deliverEvent = <Event extends TelegramEventName>(
    event: Event,
    payload: TelegramEventPayloads[Event],
  ): void => {
    for (const handler of handlerSets[event]) {
      handler(payload)
    }
  }

  const receiveEvent = (eventType: string, eventData: unknown): void => {
    if (!isTelegramEventName(eventType)) {
      return
    }
    if (handlerSets[eventType].size === 0) {
      return
    }

    const parseResult = parseEventPayloadOrLog(eventType, eventData)
    if (parseResult.success) {
      deliverEvent(eventType, parseResult.payload)
    }
  }

  const unsubscribeFromBridge = subscribe(receiveEvent)

  return {
    on: (event, handler) => {
      if (isDestroyed) {
        throw new Error("Cannot subscribe to a destroyed event hub")
      }

      handlerSets[event].add(handler)

      return () => {
        handlerSets[event].delete(handler)
      }
    },
    destroy: () => {
      isDestroyed = true
      unsubscribeFromBridge()
      for (const handlers of Object.values(handlerSets)) {
        handlers.clear()
      }
    },
  }
}

export { createEventHub, type EventHub }
