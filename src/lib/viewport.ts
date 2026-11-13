import type { PartialSafeAreaInsets, SafeAreaInsets } from "#lib/protocol/methods"

import { invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./features/controller"
import type { TelegramRuntime } from "./telegram-runtime"

import { getPlatform } from "./platform"
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

type ViewportActions = {
  expand: () => void
  requestFullscreen: () => Promise<void>
  exitFullscreen: () => Promise<void>
}

type ViewportController = FeatureController<ViewportState, ViewportActions>

type ViewportHandle = {
  feature: ViewportController
  /** Session-owned: mounts the event subscriptions and requests the initial state. */
  mount: () => Promise<void>
  /** Session-owned: binds the viewport and safe-area CSS variables. */
  bindCssVars: () => () => void
}

const zeroInsets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 }

const mergeInsets = (current: SafeAreaInsets, partial: PartialSafeAreaInsets): SafeAreaInsets => {
  return {
    top: partial.top ?? current.top,
    bottom: partial.bottom ?? current.bottom,
    left: partial.left ?? current.left,
    right: partial.right ?? current.right,
  }
}

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
): ViewportHandle => {
  const { protocol } = runtime
  const { platform } = options
  const platformInfo = getPlatform(platform)
  const isFullscreenSupported = protocol.mayInvoke("web_app_request_fullscreen")
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
      protocol.on("viewport_changed", (event) => {
        store.update({
          height: event.height,
          width: event.width ?? window.innerWidth,
          isExpanded: event.is_expanded,
          ...(event.is_state_stable ? { stableHeight: event.height } : {}),
        })
      }),
    )
    runtime.disposer.add(
      protocol.on("fullscreen_changed", (event) => {
        store.update({ isFullscreen: event.is_fullscreen })
      }),
    )
    runtime.disposer.add(
      protocol.on("safe_area_changed", (insets) => {
        store.update({ safeAreaInsets: mergeInsets(store.get().safeAreaInsets, insets) })
      }),
    )
    runtime.disposer.add(
      protocol.on("content_safe_area_changed", (insets) => {
        store.update({
          contentSafeAreaInsets: mergeInsets(store.get().contentSafeAreaInsets, insets),
        })
      }),
    )

    if (!platformInfo.supportsViewport || !protocol.mayInvoke("web_app_request_viewport")) {
      store.update({ isExpanded: true })
    } else {
      try {
        await protocol.request({
          method: ["web_app_request_viewport"],
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
    if (protocol.mayInvoke("web_app_request_safe_area")) {
      invokeBestEffort(protocol, "web_app_request_safe_area")
    }
    if (protocol.mayInvoke("web_app_request_content_safe_area")) {
      invokeBestEffort(protocol, "web_app_request_content_safe_area")
    }
  }

  const changeFullscreen = async (fullscreen: boolean): Promise<void> => {
    if (!isFullscreenSupported) {
      throw new Error("Fullscreen mode is not supported in this Telegram version")
    }

    const result = await protocol.request({
      method: fullscreen ? ["web_app_request_fullscreen"] : ["web_app_exit_fullscreen"],
      timeout: initialViewportRequestTimeoutMs,
    })

    if (result.event === "fullscreen_failed") {
      // The requested state is already the native state, so the transition succeeded.
      if (result.payload.error === "ALREADY_FULLSCREEN") {
        store.update({ isFullscreen: fullscreen })
        return
      }
      throw new Error(`Fullscreen request failed: ${result.payload.error}`)
    }
  }

  const feature: ViewportController = {
    supported:
      protocol.mayInvoke("web_app_expand") || protocol.mayInvoke("web_app_request_fullscreen"),
    state: store,
    actions: {
      expand: () => {
        if (protocol.mayInvoke("web_app_expand")) {
          invokeBestEffort(protocol, "web_app_expand")
        }
      },
      requestFullscreen: async () => changeFullscreen(true),
      exitFullscreen: async () => changeFullscreen(false),
    },
  }

  return {
    feature,
    mount: async () => {
      if (runtime.disposer.isDisposed) {
        throw new Error("Cannot mount a disposed Telegram viewport")
      }
      mountPromise ??= doMount()
      return mountPromise
    },
    bindCssVars: () => bindViewportCssVariables(store),
  }
}

export {
  createViewport,
  initialViewportState,
  type ViewportActions,
  type ViewportController,
  type ViewportHandle,
  type ViewportState,
}
