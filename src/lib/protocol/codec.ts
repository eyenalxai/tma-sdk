import type { EventName, EventPayloads, Method, MethodParams } from "./methods"

import { eventTable, methodDefinitions } from "./methods"

type WireEventData = string | Record<string, unknown>

type WireMessage = {
  eventType: string
  eventData: WireEventData
  nativePayload: string
}

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

/**
 * Turns a typed method call into the three payload shapes the Telegram clients
 * use: the `eventData` value for the JSON envelope, and the string the native
 * proxy receives.
 */
const encodeMethod = <M extends Method>(method: M, params?: MethodParams<M>): WireMessage => {
  const definition = methodDefinitions[method]
  if (definition.raw === true) {
    const raw = typeof params === "string" ? params : ""
    const eventData = { data: raw }
    return {
      eventType: method,
      eventData,
      nativePayload: JSON.stringify(eventData),
    }
  }

  const eventData: WireEventData = params ?? ""

  return {
    eventType: method,
    eventData,
    // The official bridge always hands the native proxy a string.
    nativePayload: JSON.stringify(eventData),
  }
}

const parseEventPayload = <E extends EventName>(
  event: E,
  eventData?: unknown,
  browserWindow?: { readonly innerHeight?: unknown; readonly innerWidth?: unknown },
): EventPayloads[E] => {
  const parsed = tryParseJson(eventData)
  const definition = eventTable[event]
  if ((parsed === null || parsed === undefined) && "fallback" in definition) {
    // The table owns the fallback; the caller injects the protocol window.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return definition.fallback(browserWindow) as EventPayloads[E]
  }
  // The table correlates the schema with the event name at runtime only.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return definition.schema.parse(parsed) as EventPayloads[E]
}

export { encodeMethod, parseEventPayload, type WireMessage }
