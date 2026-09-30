import type { OpenLinkBrowser, TelegramMethodParams } from "./post-event"
import type { TelegramRuntime } from "./telegram-runtime"

import { postEvent } from "./post-event"
import { supports, supportsParam } from "./version"

type OpenLinkOptions = {
  tryInstantView?: boolean
  tryBrowser?: OpenLinkBrowser
}

const TELEGRAM_HOSTNAMES = new Set(["t.me", "telegram.me", "telegram.dog"])

const createOpenLink =
  (runtime: TelegramRuntime) =>
  (url: string | URL, linkOptions: OpenLinkOptions = {}): void => {
    const params: TelegramMethodParams["web_app_open_link"] = { url: new URL(url).toString() }
    if (
      linkOptions.tryBrowser !== undefined &&
      supportsParam("web_app_open_link.try_browser", runtime.version)
    ) {
      params.try_browser = linkOptions.tryBrowser
    }
    if (
      linkOptions.tryInstantView !== undefined &&
      supportsParam("web_app_open_link.try_instant_view", runtime.version)
    ) {
      params.try_instant_view = linkOptions.tryInstantView
    }
    postEvent("web_app_open_link", params)
  }

const createOpenTelegramLink =
  (runtime: TelegramRuntime) =>
  (url: string | URL): void => {
    const parsed = new URL(url)
    if (!TELEGRAM_HOSTNAMES.has(parsed.hostname)) {
      throw new Error(`URL has disallowed hostname: ${parsed.hostname}`)
    }

    const path = parsed.pathname + parsed.search
    if (supports("web_app_open_tg_link", runtime.version)) {
      postEvent("web_app_open_tg_link", { path_full: path })
      return
    }

    window.location.href = parsed.toString()
  }

export { createOpenLink, createOpenTelegramLink, type OpenLinkOptions }
