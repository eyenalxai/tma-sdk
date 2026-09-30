import { useSyncExternalStore } from "react"

import type { ViewportState } from "#lib/viewport"

import { initialViewportState } from "#lib/viewport"

import { useTelegram } from "./use-telegram"

const useViewportState = (): ViewportState => {
  const { store } = useTelegram().viewport
  return useSyncExternalStore(store.subscribe, store.get, () => initialViewportState)
}

const useIsFullscreen = (): boolean => {
  const { store } = useTelegram().viewport
  return useSyncExternalStore(
    store.subscribe,
    () => store.get().isFullscreen,
    () => false,
  )
}

export { useIsFullscreen, useViewportState }
