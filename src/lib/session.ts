import type { Protocol } from "#lib/protocol/client"

import { createProtocol, invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { BackButton } from "./back-button"
import type { HapticFeedback } from "./haptic-feedback"
import type { InitData } from "./init-data"
import type { LaunchParams } from "./launch-params"
import type { OpenLinkOptions } from "./links"
import type { MiniApp } from "./mini-app"
import type { EventName, EventPayloads } from "./protocol/methods"
import type { WriteAccessStatus } from "./request-write-access"
import type { Store } from "./store"
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
  status: Store<SessionStatus>
  start: () => Promise<void>
  markReady: () => void
  destroy: () => void
}

const statefulEvents = [
  "viewport_changed",
  "fullscreen_changed",
  "safe_area_changed",
  "content_safe_area_changed",
  "theme_changed",
  "visibility_changed",
] as const satisfies readonly EventName[]

/**
 * Keeps the last payload of every stateful event and replays it to a new
 * subscriber. Telegram sends some events before the app has subscribed, so a
 * plain `on` would lose the first viewport, theme or visibility state.
 */
const createReplayingProtocol = (protocol: Protocol): Protocol => {
  const lastPayloads = new Map<EventName, EventPayloads[EventName]>()

  for (const event of statefulEvents) {
    protocol.on(event, (payload) => {
      lastPayloads.set(event, payload)
    })
  }

  const on: Protocol["on"] = (event, handler) => {
    let delivered = false
    const unsubscribe = protocol.on(event, (payload) => {
      delivered = true
      handler(payload)
    })

    const lastPayload = lastPayloads.get(event)
    if (!delivered && lastPayload !== undefined) {
      // The event name and its payload are correlated by the protocol table.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      handler(lastPayload as EventPayloads[typeof event])
    }

    return unsubscribe
  }

  return {
    ...protocol,
    on,
    destroy: () => {
      lastPayloads.clear()
      protocol.destroy()
    },
  }
}

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
  })
  const protocol = createReplayingProtocol(baseProtocol)
  const runtime: TelegramRuntime = { protocol, disposer }
  const features = createFeatures(runtime, launch)
  const status = createStore<SessionStatus>("launched")
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
      await features.viewport.mount()
      if (isDestroyed) {
        return
      }

      if (typeof document !== "undefined") {
        unbindCssVars ??= features.viewport.bindCssVars()
      }
      if (status.get() === "launched") {
        status.set("mounted")
      }
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
    status,
    start: async () => {
      if (isDestroyed) {
        throw new Error("Cannot start a closed Telegram Mini App session")
      }
      startPromise ??= startSession()
      await startPromise
    },
    markReady: () => {
      if (isDestroyed || status.get() === "ready") {
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
