"use client"

import type { ViewportState } from "@eyenalxai/tma-sdk/lib/viewport"

import { initialViewportState } from "@eyenalxai/tma-sdk/lib/viewport"
import { useSyncExternalStore } from "react"

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
