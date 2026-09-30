import type { BackButton } from "./back-button"
import type { HapticFeedback } from "./haptic-feedback"
import type { InitData } from "./init-data"
import type { LaunchParams } from "./launch-params"
import type { OpenLinkOptions } from "./links"
import type { MiniApp } from "./mini-app"
import type { WriteAccessStatus } from "./request-write-access"
import type { SwipeBehavior } from "./swipe-behavior"
import type { TelegramRuntime } from "./telegram-runtime"
import type { Viewport } from "./viewport"

import { createBackButton } from "./back-button"
import { createDisposer } from "./disposer"
import { createDownloadFile } from "./download-file"
import { createEventHub } from "./event-hub"
import { createHapticFeedback } from "./haptic-feedback"
import { parseInitData } from "./init-data"
import { retrieveLaunchParams } from "./launch-params"
import { createOpenLink, createOpenTelegramLink } from "./links"
import { createMiniApp } from "./mini-app"
import { postEvent } from "./post-event"
import { createRequest } from "./request"
import { createRequestWriteAccess } from "./request-write-access"
import { createSwipeBehavior } from "./swipe-behavior"
import { createViewport } from "./viewport"

type Telegram = {
  launchParams: LaunchParams
  rawInitData: string
  initData: InitData
  miniApp: MiniApp
  backButton: BackButton
  viewport: Viewport
  swipeBehavior: SwipeBehavior
  hapticFeedback: HapticFeedback
  openLink: (url: string | URL, options?: OpenLinkOptions) => void
  openTelegramLink: (url: string | URL) => void
  downloadFile: (url: string, fileName: string) => Promise<void>
  requestWriteAccess: () => Promise<WriteAccessStatus>
}

type TelegramSession = {
  telegram: Telegram
  destroy: () => void
}

/**
 * Creates a Telegram Mini App session: reads launch parameters and init data,
 * wires up the Telegram client event protocol and creates feature controllers.
 *
 * Client-only: must be called in a browser environment (inside Telegram).
 * @throws If launch parameters could not be retrieved (not a Telegram environment).
 */
const createTelegramSession = (): TelegramSession => {
  const launchParams = retrieveLaunchParams()
  const rawInitData = launchParams.tgWebAppData
  if (rawInitData === undefined || rawInitData === "") {
    throw new Error("Could not retrieve Telegram init data")
  }
  const initData = parseInitData(rawInitData)

  const disposer = createDisposer()
  const abortController = new AbortController()
  const hub = createEventHub()
  const request = createRequest({ hub, signal: abortController.signal })
  const runtime: TelegramRuntime = {
    version: launchParams.tgWebAppVersion,
    hub,
    request,
    disposer,
  }

  try {
    disposer.add(() => {
      hub.destroy()
    })
    disposer.add(() => {
      abortController.abort()
    })
    disposer.add(
      hub.on("reload_iframe", () => {
        postEvent("iframe_will_reload")
        window.location.reload()
      }),
    )

    // Accept custom styles from the Telegram web application.
    const style = document.createElement("style")
    style.id = "telegram-custom-styles"
    document.head.append(style)
    disposer.add(() => {
      style.remove()
    })
    disposer.add(
      hub.on("set_custom_style", (html) => {
        style.innerHTML = html
      }),
    )

    // Notify Telegram that the iframe is ready, enabling style and reload events.
    postEvent("iframe_ready", { reload_supported: true })
  } catch (error) {
    disposer.dispose()
    throw error
  }

  return {
    telegram: {
      launchParams,
      rawInitData,
      initData,
      miniApp: createMiniApp(runtime),
      backButton: createBackButton(runtime),
      viewport: createViewport(runtime, {
        platform: launchParams.tgWebAppPlatform,
        isFullscreen: launchParams.tgWebAppFullscreen ?? false,
      }),
      swipeBehavior: createSwipeBehavior(runtime),
      hapticFeedback: createHapticFeedback(runtime),
      openLink: createOpenLink(runtime),
      openTelegramLink: createOpenTelegramLink(runtime),
      downloadFile: createDownloadFile(runtime),
      requestWriteAccess: createRequestWriteAccess(runtime),
    },
    destroy: () => {
      disposer.dispose()
    },
  }
}

export { createTelegramSession, type Telegram, type TelegramSession }
