import { invokeBestEffort } from "#lib/protocol/client"

import type { TelegramRuntime } from "./telegram-runtime"

type SwipeBehavior = {
  isSupported: boolean
  enableVertical: () => void
  disableVertical: () => void
}

const createSwipeBehavior = (runtime: TelegramRuntime): SwipeBehavior => {
  const { protocol } = runtime
  const isSupported = protocol.mayInvoke("web_app_setup_swipe_behavior")

  const setVerticalEnabled = (enabled: boolean) => {
    if (isSupported) {
      invokeBestEffort(protocol, "web_app_setup_swipe_behavior", { allow_vertical_swipe: enabled })
    }
  }

  return {
    isSupported,
    enableVertical: () => {
      setVerticalEnabled(true)
    },
    disableVertical: () => {
      setVerticalEnabled(false)
    },
  }
}

export { createSwipeBehavior, type SwipeBehavior }
