import type { Protocol } from "#lib/protocol/client"
import type { EventName, EventPayloads } from "#lib/protocol/methods"
import type { ProtocolWindow } from "#lib/protocol/transport"

import { parseEventPayload } from "#lib/protocol/codec"
import { isEventName } from "#lib/protocol/methods"
import { createTransport, getBrowserWindow, installInboundBridge } from "#lib/protocol/transport"

const statefulEvents = [
  "viewport_changed",
  "fullscreen_changed",
  "safe_area_changed",
  "content_safe_area_changed",
  "theme_changed",
  "visibility_changed",
] as const satisfies readonly EventName[]

type StatefulEvent = (typeof statefulEvents)[number]

const statefulEventNames: ReadonlySet<EventName> = new Set(statefulEvents)
const lastPayloadsByWindow = new WeakMap<ProtocolWindow, Map<EventName, EventPayloads[EventName]>>()
const installedWindows = new WeakSet<ProtocolWindow>()

const isStatefulEvent = (event: EventName): event is StatefulEvent => statefulEventNames.has(event)

const getLastPayloads = (
  browserWindow: ProtocolWindow,
): Map<EventName, EventPayloads[EventName]> => {
  let lastPayloads = lastPayloadsByWindow.get(browserWindow)
  if (lastPayloads === undefined) {
    lastPayloads = new Map()
    lastPayloadsByWindow.set(browserWindow, lastPayloads)
  }
  return lastPayloads
}

const getOptionalBrowserWindow = (): ProtocolWindow | null => {
  try {
    return getBrowserWindow()
  } catch {
    return null
  }
}

/**
 * Captures stateful events that Telegram sends before `createSession()` runs.
 * The session installs its own bridge later and seeds its replay cache from
 * this buffer, so the first subscriber still sees the initial state.
 */
const installEarlyEventCapture = (browserWindow?: ProtocolWindow): void => {
  const targetWindow = browserWindow ?? getOptionalBrowserWindow()
  if (targetWindow === null) {
    return
  }

  if (installedWindows.has(targetWindow)) {
    return
  }

  let targetOrigin: string | null = null
  try {
    targetOrigin = createTransport(targetWindow).targetOrigin
  } catch {
    // A window that cannot resolve its Telegram origin cannot host a session either.
    return
  }

  try {
    installInboundBridge(
      targetWindow,
      (eventType, eventData) => {
        if (!isEventName(eventType) || !isStatefulEvent(eventType)) {
          return
        }
        try {
          getLastPayloads(targetWindow).set(
            eventType,
            parseEventPayload(eventType, eventData, targetWindow),
          )
        } catch {
          // No session exists yet to report a malformed payload to.
        }
      },
      targetOrigin,
    )
  } catch {
    // The session installs its own bridge and reports the failure at construction.
    return
  }

  installedWindows.add(targetWindow)
}

/**
 * Keeps the last payload of every stateful event and replays it to a new
 * subscriber. The cache starts from events captured before the session existed
 * and then follows the live protocol.
 */
const createReplayingProtocol = (protocol: Protocol, browserWindow: ProtocolWindow): Protocol => {
  const lastPayloads = new Map<EventName, EventPayloads[EventName]>(getLastPayloads(browserWindow))

  for (const event of statefulEvents) {
    protocol.on(event, (payload) => {
      lastPayloads.set(event, payload)
    })
  }

  const on: Protocol["on"] = (event, handler) => {
    let delivered = false
    const unsubscribe = protocol.on(event, (payload) => {
      delivered = true
      handler(payload)
    })

    const lastPayload = lastPayloads.get(event)
    if (!delivered && lastPayload !== undefined) {
      // The event name and its payload are correlated by the protocol table.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      handler(lastPayload as EventPayloads[typeof event])
    }

    return unsubscribe
  }

  return {
    ...protocol,
    on,
    destroy: () => {
      lastPayloads.clear()
      protocol.destroy()
    },
  }
}

export { createReplayingProtocol, installEarlyEventCapture, statefulEvents }
