import type { SafeAreaInsets } from "./events"
import type { TelegramMethod } from "./post-event"
import type { Store } from "./store"

import { on } from "./events"
import { postEventBestEffort } from "./post-event"
import { request } from "./request"
import { createStore } from "./store"
import { supports } from "./version"

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

type ViewportController = Viewport & {
  destroy: () => void
}

const zeroInsets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 }
const INITIAL_REQUEST_TIMEOUT_MS = 5000
const stableViewportPlatforms = new Set(["macos", "tdesktop", "unigram", "web", "weba", "webk"])

const initialViewportState: ViewportState = {
  height: 0,
  width: 0,
  stableHeight: 0,
  isExpanded: false,
  isFullscreen: false,
  safeAreaInsets: zeroInsets,
  contentSafeAreaInsets: zeroInsets,
}

const readCssVarValues = (
  state: ViewportState,
): readonly (readonly [name: string, value: number])[] => [
  ["--tg-viewport-height", state.height],
  ["--tg-viewport-width", state.width],
  ["--tg-viewport-stable-height", state.stableHeight],
  ["--tg-viewport-safe-area-inset-top", state.safeAreaInsets.top],
  ["--tg-viewport-safe-area-inset-bottom", state.safeAreaInsets.bottom],
  ["--tg-viewport-safe-area-inset-left", state.safeAreaInsets.left],
  ["--tg-viewport-safe-area-inset-right", state.safeAreaInsets.right],
  ["--tg-viewport-content-safe-area-inset-top", state.contentSafeAreaInsets.top],
  ["--tg-viewport-content-safe-area-inset-bottom", state.contentSafeAreaInsets.bottom],
  ["--tg-viewport-content-safe-area-inset-left", state.contentSafeAreaInsets.left],
  ["--tg-viewport-content-safe-area-inset-right", state.contentSafeAreaInsets.right],
]

const hasStableViewport = (platform: string): boolean => stableViewportPlatforms.has(platform)
const shouldRequestContentSafeArea = (platform: string, version: string): boolean =>
  platform !== "macos" && supports("web_app_request_content_safe_area", version)

const runInitialRequest = async (
  method: TelegramMethod,
  execute: () => Promise<unknown>,
): Promise<void> => {
  try {
    await execute()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return
    }
    console.warn(`[Telegram] Initial "${method}" request failed`, error)
  }
}

const createViewport = (options: {
  version: string
  platform: string
  isFullscreen: boolean
}): ViewportController => {
  const { version } = options
  const isFullscreenSupported = supports("web_app_request_fullscreen", version)

  const store = createStore<ViewportState>({
    ...initialViewportState,
    height: window.innerHeight,
    width: window.innerWidth,
    stableHeight: window.innerHeight,
    isFullscreen: options.isFullscreen,
  })

  const cleanups: (() => void)[] = []
  const abortController = new AbortController()
  let mountPromise: Promise<void> | null = null
  let isDestroyed = false

  const doMount = async () => {
    const stableViewport = hasStableViewport(options.platform)
    const safeAreaSupported = supports("web_app_request_safe_area", version)
    const contentSafeAreaSupported = shouldRequestContentSafeArea(options.platform, version)
    cleanups.push(
      on("viewport_changed", (event) => {
        store.update({
          height: event.height,
          width: event.width ?? window.innerWidth,
          isExpanded: event.is_expanded,
          ...(event.is_state_stable ? { stableHeight: event.height } : {}),
        })
      }),
      on("fullscreen_changed", (event) => {
        store.update({ isFullscreen: event.is_fullscreen })
      }),
      on("safe_area_changed", (insets) => {
        store.update({ safeAreaInsets: insets })
      }),
      on("content_safe_area_changed", (insets) => {
        store.update({ contentSafeAreaInsets: insets })
      }),
    )

    // The requests below trigger events handled by the listeners above,
    // Which populate the store. Awaiting them means "initial state received".
    const initialRequests: Promise<void>[] = []
    if (stableViewport) {
      store.update({ isExpanded: true })
    } else {
      initialRequests.push(
        runInitialRequest("web_app_request_viewport", async () => {
          await request({
            method: ["web_app_request_viewport"],
            events: ["viewport_changed"],
            signal: abortController.signal,
            timeout: INITIAL_REQUEST_TIMEOUT_MS,
          })
        }),
      )
    }
    if (safeAreaSupported) {
      initialRequests.push(
        runInitialRequest("web_app_request_safe_area", async () => {
          await request({
            method: ["web_app_request_safe_area"],
            events: ["safe_area_changed"],
            signal: abortController.signal,
            timeout: INITIAL_REQUEST_TIMEOUT_MS,
          })
        }),
      )
    }
    if (contentSafeAreaSupported) {
      initialRequests.push(
        runInitialRequest("web_app_request_content_safe_area", async () => {
          await request({
            method: ["web_app_request_content_safe_area"],
            events: ["content_safe_area_changed"],
            signal: abortController.signal,
            timeout: INITIAL_REQUEST_TIMEOUT_MS,
          })
        }),
      )
    }

    await Promise.all(initialRequests)
  }

  const changeFullscreen = async (fullscreen: boolean) => {
    if (!isFullscreenSupported) {
      throw new Error("Fullscreen mode is not supported in this Telegram version")
    }

    const result = await request({
      method: fullscreen ? ["web_app_request_fullscreen"] : ["web_app_exit_fullscreen"],
      events: ["fullscreen_changed", "fullscreen_failed"],
      signal: abortController.signal,
      timeout: INITIAL_REQUEST_TIMEOUT_MS,
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
      if (isDestroyed) {
        throw new Error("Cannot mount a destroyed Telegram viewport")
      }
      mountPromise ??= doMount()
      return mountPromise
    },
    expand: () => {
      postEventBestEffort("web_app_expand")
    },
    requestFullscreen: async () => changeFullscreen(true),
    exitFullscreen: async () => changeFullscreen(false),
    bindCssVars: () => {
      const update = () => {
        const values = readCssVarValues(store.get())
        for (const [name, value] of values) {
          document.documentElement.style.setProperty(name, `${value}px`)
        }
      }

      update()
      const unsubscribe = store.subscribe(update)

      return () => {
        unsubscribe()
        for (const [name] of readCssVarValues(store.get())) {
          document.documentElement.style.removeProperty(name)
        }
      }
    },
    destroy: () => {
      if (isDestroyed) {
        return
      }
      isDestroyed = true
      abortController.abort()
      for (const cleanup of cleanups.splice(0)) {
        cleanup()
      }
    },
  }
}

export {
  createViewport,
  hasStableViewport,
  initialViewportState,
  shouldRequestContentSafeArea,
  type Viewport,
  type ViewportState,
}
