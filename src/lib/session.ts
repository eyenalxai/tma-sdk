import type { Protocol } from "#lib/protocol/client"

import { createProtocol, invokeBestEffort } from "#lib/protocol/client"
import { getBrowserWindow } from "#lib/protocol/transport"
import { createScalarStore } from "#lib/store"

import type { BackButton } from "./back-button"
import type { HapticFeedback } from "./haptic-feedback"
import type { InitData } from "./init-data"
import type { LaunchParams } from "./launch-params"
import type { OpenLinkOptions } from "./links"
import type { MiniApp } from "./mini-app"
import type { WriteAccessStatus } from "./request-write-access"
import type { ReadonlyStore } from "./store"
import type { SwipeBehavior } from "./swipe-behavior"
import type { TelegramRuntime } from "./telegram-runtime"
import type { Viewport } from "./viewport"

import { createBackButton } from "./back-button"
import { createDisposer } from "./disposer"
import { createDownloadFile } from "./download-file"
import { createHapticFeedback } from "./haptic-feedback"
import { parseInitData } from "./init-data"
import { retrieveLaunchParams } from "./launch-params"
import { createOpenLink, createOpenTelegramLink } from "./links"
import { createMiniApp } from "./mini-app"
import { createRequestWriteAccess } from "./request-write-access"
import { createReplayingProtocol, installEarlyEventCapture } from "./session/replay"
import { createSwipeBehavior } from "./swipe-behavior"
import { createViewport } from "./viewport"

type SessionStatus = "launched" | "mounted" | "ready" | "closed" | "failed"

type Features = {
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

type Session = {
  launch: LaunchParams
  initData: InitData | null
  requireInitData: () => InitData
  protocol: Protocol
  features: Features
  status: ReadonlyStore<SessionStatus>
  start: () => Promise<void>
  markReady: () => void
  destroy: () => void
}

// Capture stateful events that Telegram sends before the app creates its session.
installEarlyEventCapture()

const createFeatures = (runtime: TelegramRuntime, launch: LaunchParams): Features => {
  return {
    miniApp: createMiniApp(runtime),
    backButton: createBackButton(runtime),
    viewport: createViewport(runtime, {
      platform: launch.tgWebAppPlatform,
      isFullscreen: launch.tgWebAppFullscreen ?? false,
    }),
    swipeBehavior: createSwipeBehavior(runtime),
    hapticFeedback: createHapticFeedback(runtime),
    openLink: createOpenLink(runtime),
    openTelegramLink: createOpenTelegramLink(runtime),
    downloadFile: createDownloadFile(runtime),
    requestWriteAccess: createRequestWriteAccess(runtime),
  }
}

/**
 * Creates a Mini App session: reads the launch, installs the event bridge,
 * retains stateful events and creates the feature controllers. Returns
 * synchronously; call `start()` to mount the viewport and request initial state.
 *
 * Client-only: must be called in a browser environment (inside Telegram).
 * @throws If launch parameters could not be retrieved (not a Telegram environment).
 */
const createSession = (): Session => {
  const browserWindow = getBrowserWindow()
  const launch = retrieveLaunchParams()
  const rawInitData = launch.tgWebAppData
  const initData =
    rawInitData === undefined || rawInitData === "" ? null : parseInitData(rawInitData)

  const disposer = createDisposer()
  const abortController = new AbortController()
  const baseProtocol = createProtocol({
    platform: launch.tgWebAppPlatform,
    version: launch.tgWebAppVersion,
    signal: abortController.signal,
    window: browserWindow,
  })
  const protocol = createReplayingProtocol(baseProtocol, browserWindow)
  const runtime: TelegramRuntime = { protocol, disposer }
  const features = createFeatures(runtime, launch)
  const status = createScalarStore<SessionStatus>("launched")
  let startPromise: Promise<void> | null = null
  let unbindCssVars: (() => void) | null = null
  let isDestroyed = false

  try {
    disposer.add(() => {
      protocol.destroy()
    })
    disposer.add(() => {
      abortController.abort()
    })
    disposer.add(
      protocol.on("reload_iframe", () => {
        invokeBestEffort(protocol, "iframe_will_reload")
        window.location.reload()
      }),
    )

    // Accept custom styles from the Telegram web application.
    if (typeof document !== "undefined") {
      const style = document.createElement("style")
      style.id = "telegram-custom-styles"
      document.head.append(style)
      disposer.add(() => {
        style.remove()
      })
      disposer.add(
        protocol.on("set_custom_style", (html) => {
          style.innerHTML = html
        }),
      )
    }

    // Notify Telegram that the iframe is ready, enabling style and reload events.
    if (protocol.isFramed && protocol.mayInvoke("iframe_ready")) {
      protocol.invoke("iframe_ready", { reload_supported: true })
    }
  } catch (error) {
    disposer.dispose()
    throw error
  }

  const startSession = async (): Promise<void> => {
    try {
      if (protocol.mayInvoke("web_app_request_theme")) {
        invokeBestEffort(protocol, "web_app_request_theme")
      }
      features.backButton.sync()
      await features.viewport.mount()
      if (isDestroyed) {
        return
      }

      if (typeof document !== "undefined") {
        unbindCssVars ??= features.viewport.bindCssVars()
      }
      status.set("mounted")
    } catch (error) {
      if (!isDestroyed) {
        status.set("failed")
      }
      throw error
    }
  }

  return {
    launch,
    initData,
    requireInitData: () => {
      if (initData === null) {
        throw new Error("This Mini App launch does not contain init data")
      }
      return initData
    },
    protocol,
    features,
    status: {
      get: status.get,
      subscribe: status.subscribe,
    },
    start: async () => {
      if (isDestroyed) {
        throw new Error("Cannot start a closed Telegram Mini App session")
      }
      if (status.get() === "failed") {
        throw new Error("Cannot start a failed Telegram Mini App session")
      }
      if (status.get() !== "launched") {
        return
      }
      startPromise ??= startSession()
      await startPromise
    },
    markReady: () => {
      // Readiness is the app's decision, but only after the viewport has mounted.
      if (status.get() !== "mounted") {
        return
      }
      features.miniApp.ready()
      status.set("ready")
    },
    destroy: () => {
      if (isDestroyed) {
        return
      }
      isDestroyed = true
      status.set("closed")
      unbindCssVars?.()
      disposer.dispose()
    },
  }
}

export { createSession, type Features, type Session, type SessionStatus }
