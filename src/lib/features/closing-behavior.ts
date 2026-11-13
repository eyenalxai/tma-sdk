import type { TelegramRuntime } from "#lib/telegram-runtime"

import { invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./controller"

type ClosingBehaviorState = {
  isEnabled: boolean
}

type ClosingBehaviorActions = {
  enable: () => void
  disable: () => void
}

type ClosingBehaviorController = FeatureController<ClosingBehaviorState, ClosingBehaviorActions>

const createClosingBehavior = (runtime: TelegramRuntime): ClosingBehaviorController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_setup_closing_behavior")
  const store = createStore<ClosingBehaviorState>({ isEnabled: false })

  const setEnabled = (isEnabled: boolean): void => {
    if (!supported || store.get().isEnabled === isEnabled) {
      return
    }
    if (
      invokeBestEffort(protocol, "web_app_setup_closing_behavior", {
        need_confirmation: isEnabled,
      })
    ) {
      store.set({ isEnabled })
    }
  }

  return {
    supported,
    state: store,
    actions: {
      enable: () => {
        setEnabled(true)
      },
      disable: () => {
        setEnabled(false)
      },
    },
  }
}

export {
  createClosingBehavior,
  type ClosingBehaviorActions,
  type ClosingBehaviorController,
  type ClosingBehaviorState,
}
