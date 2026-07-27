import { isRecord } from "./is-record"

const TELEGRAM_WEB_ORIGIN = "https://web.telegram.org"

type PostEventProxy = { postEvent: (eventType: string, eventData?: string) => void }
type NotifyProxy = { notify: (message: string) => void }
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

type TelegramMethodParams = {
  iframe_ready: { reload_supported: boolean }
  iframe_will_reload: undefined
  web_app_ready: undefined
  web_app_expand: undefined
  web_app_open_link: {
    url: string
    try_browser?: OpenLinkBrowser
    try_instant_view?: boolean
  }
  web_app_open_tg_link: { path_full: string }
  web_app_set_background_color: { color: string }
  web_app_set_header_color: { color: string }
  web_app_setup_back_button: { is_visible: boolean }
  web_app_trigger_haptic_feedback:
    | { type: "impact"; impact_style: "light" | "medium" | "heavy" | "rigid" | "soft" }
    | { type: "notification"; notification_type: "error" | "success" | "warning" }
    | { type: "selection_change" }
  web_app_request_write_access: undefined
  web_app_setup_swipe_behavior: { allow_vertical_swipe: boolean }
  web_app_exit_fullscreen: undefined
  web_app_request_content_safe_area: undefined
  web_app_request_file_download: { url: string; file_name: string }
  web_app_request_fullscreen: undefined
  web_app_request_safe_area: undefined
  web_app_request_viewport: undefined
}

type TelegramMethod = keyof TelegramMethodParams
type PostEventArgs = {
  [Method in TelegramMethod]: TelegramMethodParams[Method] extends undefined
    ? [method: Method]
    : [method: Method, eventData: TelegramMethodParams[Method]]
}[TelegramMethod]

const isPostEventProxy = (value: unknown): value is PostEventProxy =>
  isRecord(value) && typeof value.postEvent === "function"

const isNotifyProxy = (value: unknown): value is NotifyProxy =>
  isRecord(value) && typeof value.notify === "function"

const isIframe = (): boolean => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Serializes a Telegram event for both supported transport shapes.
 */
const serializePostEvent = (method: TelegramMethod, eventData?: Record<string, unknown>) => {
  return {
    message: JSON.stringify({ eventType: method, eventData }),
    serializedEventData: eventData === undefined ? undefined : JSON.stringify(eventData),
  }
}

/**
 * Calls a Mini Apps method, delivering it to the Telegram client through
 * whichever communication channel the current environment provides.
 * @see https://core.telegram.org/bots/webapps#available-methods
 */
const postEvent = (...[method, eventData]: PostEventArgs): void => {
  const { message, serializedEventData } = serializePostEvent(method, eventData)

  // Telegram Web.
  if (isIframe()) {
    window.parent.postMessage(message, TELEGRAM_WEB_ORIGIN)
    return
  }

  const browserWindow: unknown = window
  if (!isRecord(browserWindow)) {
    throw new Error("Unable to post Telegram event: unknown environment")
  }

  // Telegram for iOS, macOS, Android and Telegram Desktop.
  if (isPostEventProxy(browserWindow.TelegramWebviewProxy)) {
    browserWindow.TelegramWebviewProxy.postEvent(method, serializedEventData)
    return
  }

  // Telegram for Windows Phone or old Android.
  if (isNotifyProxy(browserWindow.external)) {
    browserWindow.external.notify(message)
    return
  }

  throw new Error("Unable to post Telegram event: unknown environment")
}

const postEventBestEffort = (...args: PostEventArgs): boolean => {
  try {
    postEvent(...args)
    return true
  } catch (error) {
    console.warn(`[Telegram] Failed to post "${args[0]}"`, error)
    return false
  }
}

export {
  postEvent,
  postEventBestEffort,
  serializePostEvent,
  TELEGRAM_WEB_ORIGIN,
  type PostEventArgs,
  type OpenLinkBrowser,
  type TelegramMethod,
  type TelegramMethodParams,
}
