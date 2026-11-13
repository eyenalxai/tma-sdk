import { z } from "zod"

type Capability = "supported" | "unsupported" | "unknown"

type Platform =
  | "ios"
  | "android"
  | "macos"
  | "tdesktop"
  | "windows"
  | "web"
  | "weba"
  | "webk"
  | "unknown"

type PlatformCapabilities = Partial<Record<Platform, Capability>>

const platforms = [
  "ios",
  "android",
  "macos",
  "tdesktop",
  "windows",
  "web",
  "weba",
  "webk",
  "unknown",
] as const satisfies readonly Platform[]

const isPlatform = (value: string): value is Platform =>
  (platforms as readonly string[]).includes(value)

const normalizePlatform = (value: string): Platform => (isPlatform(value) ? value : "unknown")

const compareVersions = (a: string, b: string): number => {
  const aParts = a.split(".").map(Number)
  const bParts = b.split(".").map(Number)
  const length = Math.max(aParts.length, bParts.length)

  for (let index = 0; index < length; index += 1) {
    const aPart = aParts[index] ?? 0
    const bPart = bParts[index] ?? 0
    if (aPart !== bPart) {
      return aPart - bPart
    }
  }

  return 0
}

const payloadlessEventSchema = z.unknown().transform(() => null)

const booleanishSchema = z.union([
  z.boolean(),
  z.enum(["true", "false"]).transform((value) => value === "true"),
])

const safeAreaInsetsSchema = z.looseObject({
  top: z.number(),
  bottom: z.number(),
  left: z.number(),
  right: z.number(),
})

type SafeAreaInsets = z.output<typeof safeAreaInsetsSchema>

const viewportChangedEventSchema = z.looseObject({
  height: z.number(),
  width: z.number().optional(),
  is_state_stable: z.boolean(),
  is_expanded: z.boolean(),
})

type ViewportFallbackWindow = {
  readonly innerHeight?: unknown
  readonly innerWidth?: unknown
}

const readWindowDimension = (
  browserWindow: ViewportFallbackWindow | undefined,
  key: "innerHeight" | "innerWidth",
): number => {
  const value = browserWindow?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

// Telegram for macOS sends a null viewport payload; use the injected window.
// Outside a browser the fallback stays pure.
const viewportFallback = (browserWindow?: ViewportFallbackWindow): object => {
  return {
    height: readWindowDimension(browserWindow, "innerHeight"),
    width: readWindowDimension(browserWindow, "innerWidth"),
    is_state_stable: true,
    is_expanded: true,
  }
}

const themeChangedEventSchema = z.looseObject({
  theme_params: z.record(z.string(), z.string()),
})

const invoiceClosedEventSchema = z.looseObject({
  slug: z.string(),
  status: z.string(),
})

const popupClosedEventSchema = z.looseObject({
  button_id: z.string().optional(),
})

const qrTextReceivedEventSchema = z.looseObject({
  data: z.string(),
})

const clipboardTextReceivedEventSchema = z.looseObject({
  req_id: z.string(),
  data: z.string().optional(),
})

const writeAccessRequestedEventSchema = z.looseObject({
  status: z.enum(["allowed", "cancelled"]),
})

const phoneRequestedEventSchema = z.looseObject({
  status: z.enum(["sent", "cancelled"]),
  response: z.string().optional(),
})

const fileDownloadRequestedEventSchema = z.looseObject({
  status: z.enum(["cancelled", "downloading"]),
})

const customMethodInvokedEventSchema = z.looseObject({
  req_id: z.string(),
  result: z.unknown().optional(),
  error: z.string().optional(),
})

const fullscreenChangedEventSchema = z.looseObject({
  is_fullscreen: z.boolean(),
  blur_enabled: z.boolean().optional(),
})

const fullscreenFailedEventSchema = z.looseObject({
  error: z.string(),
})

const homeScreenCheckedEventSchema = z.looseObject({
  status: z.enum(["unsupported", "unknown", "added", "missed"]),
})

const preparedMessageFailedEventSchema = z.looseObject({
  error: z.string(),
})

const requestedChatSentEventSchema = z.looseObject({
  req_id: z.string().optional(),
})

const requestedChatFailedEventSchema = z.looseObject({
  req_id: z.string().optional(),
  error: z.string().optional(),
})

const emojiStatusFailedEventSchema = z.looseObject({
  error: z.string(),
})

const emojiStatusAccessRequestedEventSchema = z.looseObject({
  status: z.string(),
})

const biometryInfoReceivedEventSchema = z.looseObject({
  available: booleanishSchema,
  type: z.string().optional(),
  access_requested: booleanishSchema.optional(),
  access_granted: booleanishSchema.optional(),
  token_saved: booleanishSchema.optional(),
  device_id: z.string().optional(),
})

const biometryAuthRequestedEventSchema = z.looseObject({
  status: z.string(),
  token: z.string().optional(),
})

const biometryTokenUpdatedEventSchema = z.looseObject({
  status: z.string(),
})

const locationCheckedEventSchema = z.looseObject({
  available: z.boolean(),
  access_requested: z.boolean().optional(),
  access_granted: z.boolean().optional(),
})

const locationRequestedEventSchema = z.looseObject({
  available: z.boolean(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  altitude: z.number().optional(),
  course: z.number().optional(),
  speed: z.number().optional(),
  horizontal_accuracy: z.number().optional(),
  vertical_accuracy: z.number().optional(),
  course_accuracy: z.number().nullish(),
  speed_accuracy: z.number().nullish(),
})

const sensorChangedEventSchema = z.looseObject({
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

const deviceOrientationChangedEventSchema = z.looseObject({
  absolute: z.boolean(),
  alpha: z.number(),
  beta: z.number(),
  gamma: z.number(),
})

const sensorFailedEventSchema = z.looseObject({
  error: z.string(),
})

const storageKeySavedEventSchema = z.looseObject({
  req_id: z.string(),
})

const storageKeyReceivedEventSchema = z.looseObject({
  req_id: z.string(),
  value: z.string().nullish(),
})

const storageFailedEventSchema = z.looseObject({
  req_id: z.string().optional(),
  error: z.string(),
})

const eventTable = {
  accelerometer_changed: {
    schema: sensorChangedEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  accelerometer_failed: {
    schema: sensorFailedEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported" },
  },
  accelerometer_started: {
    schema: payloadlessEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  accelerometer_stopped: {
    schema: payloadlessEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  back_button_pressed: { schema: payloadlessEventSchema, since: "6.1" },
  biometry_auth_requested: {
    schema: biometryAuthRequestedEventSchema,
    since: "7.2",
    platforms: { tdesktop: "unsupported", windows: "unsupported", webk: "unsupported" },
  },
  biometry_info_received: { schema: biometryInfoReceivedEventSchema, since: "7.2" },
  biometry_token_updated: {
    schema: biometryTokenUpdatedEventSchema,
    since: "7.2",
    platforms: { tdesktop: "unsupported", windows: "unsupported", webk: "unsupported" },
  },
  clipboard_text_received: { schema: clipboardTextReceivedEventSchema, since: "6.4" },
  content_safe_area_changed: {
    schema: safeAreaInsetsSchema,
    since: "8.0",
    platforms: { macos: "unsupported" },
  },
  custom_method_invoked: { schema: customMethodInvokedEventSchema, since: "6.9" },
  device_orientation_changed: {
    schema: deviceOrientationChangedEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  device_orientation_failed: {
    schema: sensorFailedEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported" },
  },
  device_orientation_started: {
    schema: payloadlessEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  device_orientation_stopped: {
    schema: payloadlessEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  device_storage_cleared: { schema: storageKeySavedEventSchema, since: "9.0" },
  device_storage_failed: { schema: storageFailedEventSchema, since: "9.0" },
  device_storage_key_received: { schema: storageKeyReceivedEventSchema, since: "9.0" },
  device_storage_key_saved: { schema: storageKeySavedEventSchema, since: "9.0" },
  emoji_status_access_requested: {
    schema: emojiStatusAccessRequestedEventSchema,
    since: "8.0",
  },
  emoji_status_failed: { schema: emojiStatusFailedEventSchema, since: "8.0" },
  emoji_status_set: { schema: payloadlessEventSchema, since: "8.0" },
  file_download_requested: { schema: fileDownloadRequestedEventSchema, since: "8.0" },
  fullscreen_changed: { schema: fullscreenChangedEventSchema, since: "8.0" },
  fullscreen_failed: {
    schema: fullscreenFailedEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  gyroscope_changed: {
    schema: sensorChangedEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  gyroscope_failed: {
    schema: sensorFailedEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported" },
  },
  gyroscope_started: {
    schema: payloadlessEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  gyroscope_stopped: {
    schema: payloadlessEventSchema,
    since: "8.0",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  home_screen_added: {
    schema: payloadlessEventSchema,
    since: "8.0",
    platforms: {
      macos: "unsupported",
      tdesktop: "unsupported",
      windows: "unsupported",
      webk: "unsupported",
    },
  },
  home_screen_checked: { schema: homeScreenCheckedEventSchema, since: "8.0" },
  home_screen_failed: {
    schema: sensorFailedEventSchema,
    since: "8.0",
    platforms: {
      ios: "unsupported",
      macos: "unsupported",
    },
  },
  invoice_closed: { schema: invoiceClosedEventSchema, since: "6.1" },
  location_checked: { schema: locationCheckedEventSchema, since: "8.0" },
  location_requested: { schema: locationRequestedEventSchema, since: "8.0" },
  main_button_pressed: { schema: payloadlessEventSchema, since: "6.0" },
  phone_requested: { schema: phoneRequestedEventSchema, since: "6.9" },
  popup_closed: { schema: popupClosedEventSchema, since: "6.2" },
  prepared_message_failed: { schema: preparedMessageFailedEventSchema, since: "8.0" },
  prepared_message_sent: { schema: payloadlessEventSchema, since: "8.0" },
  qr_text_received: {
    schema: qrTextReceivedEventSchema,
    since: "6.4",
    platforms: {
      macos: "unsupported",
      tdesktop: "unsupported",
      windows: "unsupported",
      webk: "unsupported",
    },
  },
  reload_iframe: {
    schema: payloadlessEventSchema,
    since: "6.0",
    platforms: {
      ios: "unsupported",
      android: "unsupported",
      macos: "unsupported",
      webk: "supported",
    },
  },
  requested_chat_failed: { schema: requestedChatFailedEventSchema, since: "9.6" },
  requested_chat_sent: { schema: requestedChatSentEventSchema, since: "9.6" },
  safe_area_changed: {
    schema: safeAreaInsetsSchema,
    since: "8.0",
    platforms: { webk: "unsupported" },
  },
  scan_qr_popup_closed: {
    schema: payloadlessEventSchema,
    since: "7.7",
    platforms: { macos: "unsupported", tdesktop: "unsupported", windows: "unsupported" },
  },
  secondary_button_pressed: { schema: payloadlessEventSchema, since: "7.10" },
  secure_storage_cleared: {
    schema: storageKeySavedEventSchema,
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", webk: "unsupported" },
  },
  secure_storage_failed: {
    schema: storageFailedEventSchema,
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", webk: "unsupported" },
  },
  secure_storage_key_received: {
    schema: storageKeyReceivedEventSchema,
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", webk: "unsupported" },
  },
  secure_storage_key_restored: {
    schema: storageKeyReceivedEventSchema,
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", webk: "unsupported" },
  },
  secure_storage_key_saved: {
    schema: storageKeySavedEventSchema,
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", webk: "unsupported" },
  },
  set_custom_style: {
    schema: z.string(),
    since: "6.0",
    platforms: {
      ios: "unsupported",
      android: "unsupported",
      macos: "unsupported",
      tdesktop: "unsupported",
      windows: "unsupported",
      webk: "unsupported",
    },
  },
  settings_button_pressed: { schema: payloadlessEventSchema, since: "6.1" },
  theme_changed: { schema: themeChangedEventSchema, since: "6.0" },
  viewport_changed: {
    schema: viewportChangedEventSchema,
    since: "6.0",
    platforms: { webk: "unsupported" },
    fallback: viewportFallback,
  },
  visibility_changed: {
    schema: z.looseObject({ is_visible: z.boolean() }),
    since: "8.0",
  },
  write_access_requested: { schema: writeAccessRequestedEventSchema, since: "6.9" },
} as const satisfies Record<
  string,
  {
    schema: z.ZodType
    since: string
    platforms?: PlatformCapabilities
    fallback?: (browserWindow?: ViewportFallbackWindow) => unknown
  }
>

type EventName = keyof typeof eventTable

type EventPayloads = {
  [Event in EventName]: z.output<(typeof eventTable)[Event]["schema"]>
}

const isEventName = (value: string): value is EventName => Object.hasOwn(eventTable, value)

type OpenLinkBrowser =
  | "google-chrome"
  | "chrome"
  | "mozilla-firefox"
  | "firefox"
  | "microsoft-edge"
  | "edge"
  | "opera"
  | "opera-mini"
  | "brave"
  | "brave-browser"
  | "duckduckgo"
  | "duckduckgo-browser"
  | "samsung"
  | "samsung-browser"
  | "vivaldi"
  | "vivaldi-browser"
  | "kiwi"
  | "kiwi-browser"
  | "uc"
  | "uc-browser"
  | "tor"
  | "tor-browser"
  | "safari"

type MainButtonParams = {
  is_visible: boolean
  is_active?: boolean
  text?: string
  color?: string
  text_color?: string
  is_progress_visible?: boolean
  has_shine_effect?: boolean
  icon_custom_emoji_id?: string
}

type HapticFeedbackParams =
  | { type: "impact"; impact_style: "light" | "medium" | "heavy" | "rigid" | "soft" }
  | { type: "notification"; notification_type: "error" | "success" | "warning" }
  | { type: "selection_change" }

type PopupButton = {
  id?: string
  type: "default" | "destructive" | "ok" | "cancel" | "close"
  text?: string
}

type PopupParams = {
  title?: string
  message: string
  buttons: readonly PopupButton[]
}

// The params column of the protocol table. Every key here must have a runtime row below.
type MethodParamsMap = {
  iframe_ready: { reload_supported: boolean }
  iframe_will_reload: undefined
  web_app_ready: undefined
  web_app_expand: undefined
  web_app_close: { return_back?: boolean }
  web_app_data_send: string
  web_app_switch_inline_query: {
    query: string
    chat_types?: readonly ("users" | "bots" | "groups" | "channels")[]
  }
  web_app_open_link: {
    url: string
    try_instant_view?: boolean
    try_browser?: OpenLinkBrowser
  }
  web_app_open_tg_link: { path_full: string; force_request?: boolean }
  web_app_open_invoice: { slug: string }
  web_app_setup_main_button: MainButtonParams
  web_app_setup_secondary_button: MainButtonParams & {
    position?: "left" | "right" | "top" | "bottom"
  }
  web_app_setup_back_button: { is_visible: boolean }
  web_app_setup_settings_button: { is_visible: boolean }
  web_app_setup_closing_behavior: { need_confirmation: boolean }
  web_app_setup_swipe_behavior: { allow_vertical_swipe: boolean }
  web_app_set_header_color: { color: string } | { color_key: "bg_color" | "secondary_bg_color" }
  web_app_set_background_color: { color: string }
  web_app_set_bottom_bar_color: { color: string }
  web_app_trigger_haptic_feedback: HapticFeedbackParams
  web_app_request_theme: undefined
  web_app_request_viewport: undefined
  web_app_request_safe_area: undefined
  web_app_request_content_safe_area: undefined
  web_app_request_write_access: undefined
  web_app_request_phone: undefined
  web_app_request_file_download: { url: string; file_name: string }
  web_app_request_fullscreen: undefined
  web_app_exit_fullscreen: undefined
  web_app_toggle_orientation_lock: { locked: boolean }
  web_app_add_to_home_screen: undefined
  web_app_check_home_screen: undefined
  web_app_open_popup: PopupParams
  web_app_open_scan_qr_popup: { text?: string }
  web_app_close_scan_qr_popup: undefined
  web_app_read_text_from_clipboard: { req_id: string }
  web_app_share_to_story: {
    media_url: string
    text?: string
    widget_link?: { url: string; name?: string }
  }
  web_app_send_prepared_message: { id: string }
  web_app_request_chat: { req_id: string }
  web_app_set_emoji_status: { custom_emoji_id: string; duration?: number }
  web_app_request_emoji_status_access: undefined
  web_app_hide_keyboard: undefined
  web_app_biometry_get_info: undefined
  web_app_biometry_request_access: { reason?: string }
  web_app_biometry_request_auth: { reason?: string }
  web_app_biometry_update_token: { token: string }
  web_app_biometry_open_settings: undefined
  web_app_check_location: undefined
  web_app_request_location: undefined
  web_app_open_location_settings: undefined
  web_app_start_accelerometer: { refresh_rate?: number }
  web_app_stop_accelerometer: undefined
  web_app_start_device_orientation: { refresh_rate?: number; need_absolute?: boolean }
  web_app_stop_device_orientation: undefined
  web_app_start_gyroscope: { refresh_rate?: number }
  web_app_stop_gyroscope: undefined
  web_app_invoke_custom_method: { req_id: string; method: string; params?: unknown }
  web_app_device_storage_save_key: { req_id: string; key: string; value: string | null }
  web_app_device_storage_get_key: { req_id: string; key: string }
  web_app_device_storage_clear: { req_id: string }
  web_app_secure_storage_save_key: { req_id: string; key: string; value: string | null }
  web_app_secure_storage_get_key: { req_id: string; key: string }
  web_app_secure_storage_restore_key: { req_id: string; key: string }
  web_app_secure_storage_clear: { req_id: string }
  web_app_verify_age: { passed: boolean; age: number }
}

type Method = keyof MethodParamsMap

type MethodParams<M extends Method> = MethodParamsMap[M]

type MethodArgs<M extends Method> = MethodParamsMap[M] extends undefined
  ? [method: M]
  : [method: M, params: MethodParamsMap[M]]

/**
 * Links a request param to the reply-payload field that echoes it, so a stale
 * reply for another request is not mistaken for this one's.
 */
type MethodCorrelation = {
  /** The request-params field that carries the correlation value. */
  param: string
  /** The reply-payload field that must carry the same value. */
  reply: string
  /** The host may omit the reply field; an omitted value cannot belong to another request. */
  optionalReply?: boolean
}

type MethodDefinition = {
  events: readonly EventName[]
  since: string
  raw?: boolean
  platforms?: PlatformCapabilities
  paramVersions?: Readonly<Record<string, string>>
  correlate?: MethodCorrelation
}

const unsupportedOnDesktop: PlatformCapabilities = {
  macos: "unsupported",
  tdesktop: "unsupported",
  windows: "unsupported",
}

const unsupportedOnNative: PlatformCapabilities = {
  ios: "unsupported",
  android: "unsupported",
  macos: "unsupported",
  tdesktop: "unsupported",
  windows: "unsupported",
}

const unsupportedOnWebK: PlatformCapabilities = { webk: "unsupported" }

const iframeOnly: PlatformCapabilities = {
  ...unsupportedOnNative,
  web: "supported",
  webk: "supported",
  weba: "unknown",
}

// The runtime columns of the protocol table: events, version, raw flag and platform capability.
// The wire name is the key.
const methodTable = {
  iframe_ready: { events: [], since: "6.0", platforms: iframeOnly },
  iframe_will_reload: { events: [], since: "6.0", platforms: iframeOnly },
  web_app_ready: {
    events: [],
    since: "6.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported" },
  },
  web_app_expand: {
    events: [],
    since: "6.0",
    platforms: { ...unsupportedOnDesktop, ...unsupportedOnWebK },
  },
  web_app_close: { events: [], since: "6.0", paramVersions: { return_back: "7.6" } },
  // The public payload is a raw string; the wire wraps it in `{data}`.
  web_app_data_send: { events: [], since: "6.0", raw: true },
  web_app_switch_inline_query: { events: [], since: "6.7" },
  web_app_open_link: {
    events: [],
    since: "6.1",
    paramVersions: { try_browser: "7.6", try_instant_view: "6.4" },
  },
  web_app_open_tg_link: { events: [], since: "6.1" },
  web_app_open_invoice: {
    events: ["invoice_closed"],
    since: "6.1",
    correlate: { param: "slug", reply: "slug" },
  },
  web_app_setup_main_button: { events: [], since: "6.0" },
  web_app_setup_secondary_button: { events: [], since: "7.10" },
  web_app_setup_back_button: { events: [], since: "6.1" },
  web_app_setup_settings_button: { events: [], since: "7.0" },
  web_app_setup_closing_behavior: { events: [], since: "6.2" },
  web_app_setup_swipe_behavior: {
    events: [],
    since: "7.7",
    platforms: { ...unsupportedOnDesktop, ...unsupportedOnWebK },
  },
  web_app_set_header_color: {
    events: [],
    since: "6.1",
    paramVersions: { color: "6.9" },
  },
  web_app_set_background_color: { events: [], since: "6.1" },
  web_app_set_bottom_bar_color: { events: [], since: "7.10" },
  web_app_trigger_haptic_feedback: {
    events: [],
    since: "6.1",
    platforms: unsupportedOnDesktop,
  },
  web_app_request_theme: { events: ["theme_changed"], since: "6.0" },
  web_app_request_viewport: {
    events: ["viewport_changed"],
    since: "6.0",
    platforms: unsupportedOnWebK,
  },
  web_app_request_safe_area: {
    events: ["safe_area_changed"],
    since: "8.0",
    platforms: unsupportedOnWebK,
  },
  web_app_request_content_safe_area: {
    events: ["content_safe_area_changed"],
    since: "8.0",
    platforms: { ...unsupportedOnWebK, macos: "unsupported" },
  },
  web_app_request_write_access: { events: ["write_access_requested"], since: "6.9" },
  web_app_request_phone: { events: ["phone_requested"], since: "6.9" },
  web_app_request_file_download: {
    events: ["file_download_requested"],
    since: "8.0",
  },
  web_app_request_fullscreen: {
    events: ["fullscreen_changed", "fullscreen_failed"],
    since: "8.0",
  },
  web_app_exit_fullscreen: {
    events: ["fullscreen_changed", "fullscreen_failed"],
    since: "8.0",
  },
  web_app_toggle_orientation_lock: {
    events: [],
    since: "8.0",
    platforms: { ...unsupportedOnDesktop, ...unsupportedOnWebK },
  },
  web_app_add_to_home_screen: {
    events: ["home_screen_added", "home_screen_failed"],
    since: "8.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported" },
  },
  web_app_check_home_screen: {
    events: ["home_screen_checked", "home_screen_failed"],
    since: "8.0",
  },
  web_app_open_popup: { events: ["popup_closed"], since: "6.2" },
  web_app_open_scan_qr_popup: {
    events: ["qr_text_received", "scan_qr_popup_closed"],
    since: "6.4",
    platforms: { ...unsupportedOnDesktop, ...unsupportedOnWebK },
  },
  web_app_close_scan_qr_popup: {
    events: [],
    since: "6.4",
    platforms: { ...unsupportedOnDesktop, ...unsupportedOnWebK },
  },
  web_app_read_text_from_clipboard: {
    events: ["clipboard_text_received"],
    since: "6.4",
    correlate: { param: "req_id", reply: "req_id" },
  },
  web_app_share_to_story: {
    events: [],
    since: "7.8",
    platforms: { tdesktop: "unsupported", windows: "unsupported", webk: "unknown" },
  },
  web_app_send_prepared_message: {
    events: ["prepared_message_sent", "prepared_message_failed"],
    since: "8.0",
  },
  web_app_request_chat: {
    events: ["requested_chat_sent", "requested_chat_failed"],
    since: "9.6",
    correlate: { param: "req_id", reply: "req_id", optionalReply: true },
  },
  web_app_set_emoji_status: {
    events: ["emoji_status_set", "emoji_status_failed"],
    since: "8.0",
  },
  web_app_request_emoji_status_access: {
    events: ["emoji_status_access_requested"],
    since: "8.0",
  },
  web_app_hide_keyboard: {
    events: [],
    since: "9.1",
    platforms: { ...unsupportedOnDesktop, ...unsupportedOnWebK },
  },
  web_app_biometry_get_info: {
    events: ["biometry_info_received"],
    since: "7.2",
  },
  web_app_biometry_request_access: {
    events: ["biometry_info_received"],
    since: "7.2",
    platforms: { tdesktop: "unsupported", windows: "unsupported", ...unsupportedOnWebK },
  },
  web_app_biometry_request_auth: {
    events: ["biometry_auth_requested"],
    since: "7.2",
    platforms: { tdesktop: "unsupported", windows: "unsupported", ...unsupportedOnWebK },
  },
  web_app_biometry_update_token: {
    events: ["biometry_token_updated"],
    since: "7.2",
    platforms: { tdesktop: "unsupported", windows: "unsupported", ...unsupportedOnWebK },
  },
  web_app_biometry_open_settings: {
    events: [],
    since: "7.2",
    platforms: { ...unsupportedOnDesktop, ...unsupportedOnWebK },
  },
  web_app_check_location: { events: ["location_checked"], since: "8.0" },
  web_app_request_location: { events: ["location_requested"], since: "8.0" },
  web_app_open_location_settings: { events: [], since: "8.0" },
  web_app_start_accelerometer: {
    events: ["accelerometer_started", "accelerometer_failed"],
    since: "8.0",
    platforms: unsupportedOnDesktop,
  },
  web_app_stop_accelerometer: {
    events: ["accelerometer_stopped"],
    since: "8.0",
    platforms: unsupportedOnDesktop,
  },
  web_app_start_device_orientation: {
    events: ["device_orientation_started", "device_orientation_failed"],
    since: "8.0",
    platforms: unsupportedOnDesktop,
  },
  web_app_stop_device_orientation: {
    events: ["device_orientation_stopped"],
    since: "8.0",
    platforms: unsupportedOnDesktop,
  },
  web_app_start_gyroscope: {
    events: ["gyroscope_started", "gyroscope_failed"],
    since: "8.0",
    platforms: unsupportedOnDesktop,
  },
  web_app_stop_gyroscope: {
    events: ["gyroscope_stopped"],
    since: "8.0",
    platforms: unsupportedOnDesktop,
  },
  web_app_invoke_custom_method: {
    events: ["custom_method_invoked"],
    since: "6.9",
    correlate: { param: "req_id", reply: "req_id" },
  },
  web_app_verify_age: { events: [], since: "8.0" },
  web_app_device_storage_save_key: {
    events: ["device_storage_key_saved", "device_storage_failed"],
    since: "9.0",
    correlate: { param: "req_id", reply: "req_id", optionalReply: true },
  },
  web_app_device_storage_get_key: {
    events: ["device_storage_key_received", "device_storage_failed"],
    since: "9.0",
    correlate: { param: "req_id", reply: "req_id", optionalReply: true },
  },
  web_app_device_storage_clear: {
    events: ["device_storage_cleared", "device_storage_failed"],
    since: "9.0",
    correlate: { param: "req_id", reply: "req_id", optionalReply: true },
  },
  web_app_secure_storage_save_key: {
    events: ["secure_storage_key_saved", "secure_storage_failed"],
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", ...unsupportedOnWebK },
    correlate: { param: "req_id", reply: "req_id", optionalReply: true },
  },
  web_app_secure_storage_get_key: {
    events: ["secure_storage_key_received", "secure_storage_failed"],
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", ...unsupportedOnWebK },
    correlate: { param: "req_id", reply: "req_id", optionalReply: true },
  },
  web_app_secure_storage_restore_key: {
    events: ["secure_storage_key_restored", "secure_storage_failed"],
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", ...unsupportedOnWebK },
    correlate: { param: "req_id", reply: "req_id", optionalReply: true },
  },
  web_app_secure_storage_clear: {
    events: ["secure_storage_cleared", "secure_storage_failed"],
    since: "9.0",
    platforms: { tdesktop: "unsupported", windows: "unsupported", ...unsupportedOnWebK },
    correlate: { param: "req_id", reply: "req_id", optionalReply: true },
  },
} as const satisfies Record<Method, MethodDefinition>

const methodDefinitions: Record<Method, MethodDefinition> = methodTable

type MethodEvents<M extends Method> = (typeof methodTable)[M]["events"][number]

const isMethodName = (value: string): value is Method => Object.hasOwn(methodTable, value)

const supports = (method: Method, platform: string, version: string): Capability => {
  const definition = methodDefinitions[method]
  const normalizedPlatform = normalizePlatform(platform)
  const override = definition.platforms?.[normalizedPlatform]
  if (override !== undefined) {
    return override
  }
  if (normalizedPlatform === "unknown") {
    return "unknown"
  }
  return compareVersions(version, definition.since) >= 0 ? "supported" : "unknown"
}

/**
 * Reports whether a parameter that appeared after its method is available.
 * Parameters without a recorded version follow the method's availability.
 */
const supportsParam = (method: Method, param: string, version: string): boolean => {
  const since = methodDefinitions[method].paramVersions?.[param]
  return since === undefined || compareVersions(version, since) >= 0
}

export {
  compareVersions,
  eventTable,
  isEventName,
  isMethodName,
  methodDefinitions,
  methodTable,
  normalizePlatform,
  supports,
  supportsParam,
  type Capability,
  type EventName,
  type EventPayloads,
  type HapticFeedbackParams,
  type Method,
  type MethodArgs,
  type MethodCorrelation,
  type MethodEvents,
  type MethodParams,
  type OpenLinkBrowser,
  type Platform,
  type SafeAreaInsets,
}
