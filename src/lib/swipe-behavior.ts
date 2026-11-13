import type { FeatureController } from "#lib/features/controller"
import type { TelegramRuntime } from "#lib/telegram-runtime"

import { invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

type SwipeBehaviorState = {
  isVerticalEnabled: boolean
}

type SwipeBehaviorActions = {
  enableVertical: () => void
  disableVertical: () => void
}

type SwipeBehaviorController = FeatureController<SwipeBehaviorState, SwipeBehaviorActions>

const createSwipeBehavior = (runtime: TelegramRuntime): SwipeBehaviorController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_setup_swipe_behavior")
  const store = createStore<SwipeBehaviorState>({ isVerticalEnabled: true })

  const setVerticalEnabled = (enabled: boolean): void => {
    if (!supported || store.get().isVerticalEnabled === enabled) {
      return
    }
    if (
      invokeBestEffort(protocol, "web_app_setup_swipe_behavior", { allow_vertical_swipe: enabled })
    ) {
      store.set({ isVerticalEnabled: enabled })
    }
  }

  return {
    supported,
    state: store,
    actions: {
      enableVertical: () => {
        setVerticalEnabled(true)
      },
      disableVertical: () => {
        setVerticalEnabled(false)
      },
    },
  }
}

export {
  createSwipeBehavior,
  type SwipeBehaviorActions,
  type SwipeBehaviorController,
  type SwipeBehaviorState,
}
