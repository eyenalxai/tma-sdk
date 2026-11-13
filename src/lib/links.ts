import type { FeatureController } from "#lib/features/controller"
import type { MethodParams, OpenLinkBrowser } from "#lib/protocol/methods"
import type { TelegramRuntime } from "#lib/telegram-runtime"

import { createConstantStore } from "#lib/store"

type OpenLinkOptions = {
  tryInstantView?: boolean
  tryBrowser?: OpenLinkBrowser
}

type LinksActions = {
  open: (url: string | URL, options?: OpenLinkOptions) => void
  openTelegram: (url: string | URL) => void
}

type LinksController = FeatureController<null, LinksActions>

const TELEGRAM_HOSTNAMES = new Set(["t.me", "telegram.me", "telegram.dog"])

const createLinks = (runtime: TelegramRuntime): LinksController => {
  const { protocol } = runtime

  return {
    supported: protocol.mayInvoke("web_app_open_link"),
    state: createConstantStore(null),
    actions: {
      open: (url, linkOptions = {}) => {
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
      },
      openTelegram: (url) => {
        const parsed = new URL(url)
        if (!TELEGRAM_HOSTNAMES.has(parsed.hostname)) {
          throw new Error(`URL has disallowed hostname: ${parsed.hostname}`)
        }

        if (protocol.mayInvoke("web_app_open_tg_link")) {
          protocol.invoke("web_app_open_tg_link", {
            path_full: parsed.pathname + parsed.search,
          })
          return
        }

        window.location.href = parsed.toString()
      },
    },
  }
}

export { createLinks, type LinksActions, type LinksController, type OpenLinkOptions }
