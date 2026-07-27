import type { TelegramMethod } from "./post-event"

/**
 * Mini Apps version in which each method was introduced.
 * Only methods used by this package are listed.
 * @see https://core.telegram.org/bots/webapps#available-methods
 */
const methodVersions = {
  iframe_ready: "6.0",
  iframe_will_reload: "6.0",
  web_app_ready: "6.0",
  web_app_expand: "6.0",
  web_app_open_link: "6.0",
  web_app_request_viewport: "6.0",
  web_app_open_tg_link: "6.1",
  web_app_set_background_color: "6.1",
  web_app_set_header_color: "6.1",
  web_app_setup_back_button: "6.1",
  web_app_trigger_haptic_feedback: "6.1",
  web_app_request_write_access: "6.9",
  web_app_setup_swipe_behavior: "7.7",
  web_app_exit_fullscreen: "8.0",
  web_app_request_content_safe_area: "8.0",
  web_app_request_file_download: "8.0",
  web_app_request_fullscreen: "8.0",
  web_app_request_safe_area: "8.0",
} as const satisfies Record<TelegramMethod, string>

/**
 * Method parameters that appeared later than the method itself.
 */
const methodParamVersions = {
  "web_app_open_link.try_browser": "7.6",
  "web_app_open_link.try_instant_view": "6.4",
  "web_app_set_header_color.color": "6.9",
} as const

type TelegramMethodParam = keyof typeof methodParamVersions

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

const supports = (method: TelegramMethod, version: string): boolean =>
  compareVersions(methodVersions[method], version) <= 0

const supportsParam = (param: TelegramMethodParam, version: string): boolean =>
  compareVersions(methodParamVersions[param], version) <= 0

export { compareVersions, supports, supportsParam }
