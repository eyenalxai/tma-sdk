import type { BackButton } from "./back-button"
import type { HapticFeedback } from "./haptic-feedback"
import type { InitData } from "./init-data"
import type { LaunchParams } from "./launch-params"
import type { OpenLinkOptions } from "./links"
import type { MiniApp } from "./mini-app"
import type { WriteAccessStatus } from "./request-write-access"
import type { SwipeBehavior } from "./swipe-behavior"
import type { Viewport } from "./viewport"

import { createBackButton } from "./back-button"
import { createDownloadFile } from "./download-file"
import { on } from "./events"
import { createHapticFeedback } from "./haptic-feedback"
import { parseInitData } from "./init-data"
import { retrieveLaunchParams } from "./launch-params"
import { createOpenLink, createOpenTelegramLink } from "./links"
import { createMiniApp } from "./mini-app"
import { postEvent } from "./post-event"
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
  const version = launchParams.tgWebAppVersion
  const viewport = createViewport({
    version,
    platform: launchParams.tgWebAppPlatform,
    isFullscreen: launchParams.tgWebAppFullscreen ?? false,
  })
  const abortController = new AbortController()
  let isDestroyed = false
  const cleanups: (() => void)[] = []

  try {
    cleanups.push(
      on("reload_iframe", () => {
        postEvent("iframe_will_reload")
        window.location.reload()
      }),
    )

    // Accept custom styles from the Telegram web application.
    const style = document.createElement("style")
    style.id = "telegram-custom-styles"
    document.head.append(style)
    cleanups.push(
      () => {
        style.remove()
      },
      on("set_custom_style", (html) => {
        style.innerHTML = html
      }),
    )

    // Notify Telegram that the iframe is ready, enabling style and reload events.
    postEvent("iframe_ready", { reload_supported: true })
  } catch (error) {
    for (const cleanup of cleanups.toReversed()) {
      cleanup()
    }
    abortController.abort()
    viewport.destroy()
    throw error
  }

  return {
    telegram: {
      launchParams,
      rawInitData,
      initData,
      miniApp: createMiniApp({ version }),
      backButton: createBackButton({ version }),
      viewport,
      swipeBehavior: createSwipeBehavior({ version }),
      hapticFeedback: createHapticFeedback({ version }),
      openLink: createOpenLink({ version }),
      openTelegramLink: createOpenTelegramLink({ version }),
      downloadFile: createDownloadFile({ version, signal: abortController.signal }),
      requestWriteAccess: createRequestWriteAccess({ version, signal: abortController.signal }),
    },
    destroy: () => {
      if (isDestroyed) {
        return
      }
      isDestroyed = true
      abortController.abort()
      for (const cleanup of cleanups.splice(0).toReversed()) {
        cleanup()
      }
      viewport.destroy()
    },
  }
}

export { createTelegramSession, type Telegram, type TelegramSession }
