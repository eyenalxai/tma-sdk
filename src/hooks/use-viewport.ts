import { useSyncExternalStore } from "react"

import type { ViewportState } from "#lib/viewport"

import { initialViewportState } from "#lib/viewport"

import { useSession } from "./use-session"

const useViewportState = (): ViewportState => {
  const { state } = useSession().features.viewport
  return useSyncExternalStore(state.subscribe, state.get, () => initialViewportState)
}

const useIsFullscreen = (): boolean => {
  const { state } = useSession().features.viewport
  return useSyncExternalStore(
    state.subscribe,
    () => state.get().isFullscreen,
    () => false,
  )
}

export { useIsFullscreen, useViewportState }
