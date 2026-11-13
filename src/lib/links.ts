import type { MethodParams, OpenLinkBrowser } from "#lib/protocol/methods"

import type { TelegramRuntime } from "./telegram-runtime"

type OpenLinkOptions = {
  tryInstantView?: boolean
  tryBrowser?: OpenLinkBrowser
}

const TELEGRAM_HOSTNAMES = new Set(["t.me", "telegram.me", "telegram.dog"])

const createOpenLink =
  (runtime: TelegramRuntime) =>
  (url: string | URL, linkOptions: OpenLinkOptions = {}): void => {
    const { protocol } = runtime
    const params: MethodParams<"web_app_open_link"> = { url: new URL(url).toString() }
    if (
      linkOptions.tryBrowser !== undefined &&
      protocol.supportsParam("web_app_open_link", "try_browser")
    ) {
      params.try_browser = linkOptions.tryBrowser
    }
    if (
      linkOptions.tryInstantView !== undefined &&
      protocol.supportsParam("web_app_open_link", "try_instant_view")
    ) {
      params.try_instant_view = linkOptions.tryInstantView
    }
    protocol.invoke("web_app_open_link", params)
  }

const createOpenTelegramLink =
  (runtime: TelegramRuntime) =>
  (url: string | URL): void => {
    const parsed = new URL(url)
    if (!TELEGRAM_HOSTNAMES.has(parsed.hostname)) {
      throw new Error(`URL has disallowed hostname: ${parsed.hostname}`)
    }

    const path = parsed.pathname + parsed.search
    if (runtime.protocol.mayInvoke("web_app_open_tg_link")) {
      runtime.protocol.invoke("web_app_open_tg_link", { path_full: path })
      return
    }

    window.location.href = parsed.toString()
  }

export { createOpenLink, createOpenTelegramLink, type OpenLinkOptions }
