import { z } from "zod"

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

export {
  eventSchemas,
  parseEventPayload,
  tryParseJson,
  type SafeAreaInsets,
  type TelegramEventName,
  type TelegramEventPayloads,
  type ViewportChangedEvent,
}
