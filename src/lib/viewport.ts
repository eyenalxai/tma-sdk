import type { SafeAreaInsets } from "./event-schemas"
import type { Store } from "./store"
import type { TelegramRuntime } from "./telegram-runtime"

import { isDesktopPlatform } from "./platform"
import { postEventBestEffort } from "./post-event"
import { createStore } from "./store"
import { supports } from "./version"
import { bindViewportCssVariables } from "./viewport-css-vars"

type ViewportState = {
  height: number
  width: number
  stableHeight: number
  isExpanded: boolean
  isFullscreen: boolean
  safeAreaInsets: SafeAreaInsets
  contentSafeAreaInsets: SafeAreaInsets
}

type Viewport = {
  store: Store<ViewportState>
  isFullscreenSupported: boolean
  mount: () => Promise<void>
  expand: () => void
  requestFullscreen: () => Promise<void>
  exitFullscreen: () => Promise<void>
  bindCssVars: () => () => void
}

const zeroInsets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 }

const initialViewportState: ViewportState = {
  height: 0,
  width: 0,
  stableHeight: 0,
  isExpanded: false,
  isFullscreen: false,
  safeAreaInsets: zeroInsets,
  contentSafeAreaInsets: zeroInsets,
}

const createViewport = (
  runtime: TelegramRuntime,
  options: { platform: string; isFullscreen: boolean },
): Viewport => {
  const { version } = runtime
  const { platform } = options
  const isFullscreenSupported = supports("web_app_request_fullscreen", version)
  const initialViewportRequestTimeoutMs = 5000

  const store = createStore<ViewportState>({
    ...initialViewportState,
    height: window.innerHeight,
    width: window.innerWidth,
    stableHeight: window.innerHeight,
    isFullscreen: options.isFullscreen,
  })

  let mountPromise: Promise<void> | null = null

  const doMount = async (): Promise<void> => {
    runtime.disposer.add(
      runtime.hub.on("viewport_changed", (event) => {
        store.update({
          height: event.height,
          width: event.width ?? window.innerWidth,
          isExpanded: event.is_expanded,
          ...(event.is_state_stable ? { stableHeight: event.height } : {}),
        })
      }),
    )
    runtime.disposer.add(
      runtime.hub.on("fullscreen_changed", (event) => {
        store.update({ isFullscreen: event.is_fullscreen })
      }),
    )
    runtime.disposer.add(
      runtime.hub.on("safe_area_changed", (insets) => {
        store.update({ safeAreaInsets: insets })
      }),
    )
    runtime.disposer.add(
      runtime.hub.on("content_safe_area_changed", (insets) => {
        store.update({ contentSafeAreaInsets: insets })
      }),
    )

    if (isDesktopPlatform(platform)) {
      store.update({ isExpanded: true })
    } else {
      try {
        await runtime.request({
          method: ["web_app_request_viewport"],
          events: ["viewport_changed"],
          timeout: initialViewportRequestTimeoutMs,
        })
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          console.warn('[Telegram] Initial "web_app_request_viewport" request failed', error)
        }
      }
    }

    if (runtime.disposer.isDisposed) {
      return
    }

    // Best-effort: Web K and Unigram never answer these requests. Mount must not stall on them.
    // Telegram for macOS answers the content safe-area request with `safe_area_changed` instead.
    if (supports("web_app_request_safe_area", version)) {
      postEventBestEffort("web_app_request_safe_area")
    }
    if (platform !== "macos" && supports("web_app_request_content_safe_area", version)) {
      postEventBestEffort("web_app_request_content_safe_area")
    }
  }

  const changeFullscreen = async (fullscreen: boolean): Promise<void> => {
    if (!isFullscreenSupported) {
      throw new Error("Fullscreen mode is not supported in this Telegram version")
    }

    const result = await runtime.request({
      method: fullscreen ? ["web_app_request_fullscreen"] : ["web_app_exit_fullscreen"],
      events: ["fullscreen_changed", "fullscreen_failed"],
      timeout: initialViewportRequestTimeoutMs,
    })

    if (result.event === "fullscreen_failed") {
      if (fullscreen && result.payload.error === "ALREADY_FULLSCREEN") {
        store.update({ isFullscreen: true })
        return
      }
      throw new Error(`Fullscreen request failed: ${result.payload.error}`)
    }
  }

  return {
    store,
    isFullscreenSupported,
    mount: async () => {
      if (runtime.disposer.isDisposed) {
        throw new Error("Cannot mount a disposed Telegram viewport")
      }
      mountPromise ??= doMount()
      return mountPromise
    },
    expand: () => {
      postEventBestEffort("web_app_expand")
    },
    requestFullscreen: async () => changeFullscreen(true),
    exitFullscreen: async () => changeFullscreen(false),
    bindCssVars: () => bindViewportCssVariables(store),
  }
}

export { createViewport, initialViewportState, type Viewport, type ViewportState }
