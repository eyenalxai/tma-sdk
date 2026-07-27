import { postEventBestEffort } from "./post-event"
import { supports } from "./version"

type SwipeBehavior = {
  isSupported: boolean
  enableVertical: () => void
  disableVertical: () => void
}

const createSwipeBehavior = (options: { version: string }): SwipeBehavior => {
  const isSupported = supports("web_app_setup_swipe_behavior", options.version)

  const setVerticalEnabled = (enabled: boolean) => {
    if (isSupported) {
      postEventBestEffort("web_app_setup_swipe_behavior", { allow_vertical_swipe: enabled })
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
