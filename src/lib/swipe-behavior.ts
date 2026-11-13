import type { TelegramRuntime } from "./telegram-runtime"

import { invokeBestEffort } from "./protocol/client"

type SwipeBehavior = {
  isSupported: boolean
  enableVertical: () => void
  disableVertical: () => void
}

const createSwipeBehavior = (runtime: TelegramRuntime): SwipeBehavior => {
  const { protocol } = runtime
  const isSupported = protocol.supports("web_app_setup_swipe_behavior") !== "unsupported"

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
