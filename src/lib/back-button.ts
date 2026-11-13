import type { TelegramRuntime } from "#lib/telegram-runtime"

import { invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./features/controller"

type BackButtonState = {
  isVisible: boolean
}

type BackButtonActions = {
  show: () => void
  hide: () => void
  onClick: (listener: () => void) => () => void
}

type BackButtonController = FeatureController<BackButtonState, BackButtonActions>

type BackButtonHandle = {
  feature: BackButtonController
  /** Session-owned: posts the stored visibility even when it has not changed. */
  sync: () => void
}

const createBackButton = (runtime: TelegramRuntime): BackButtonHandle => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_setup_back_button")
  const store = createStore<BackButtonState>({ isVisible: false })

  const postVisibility = (isVisible: boolean): void => {
    if (!supported) {
      return
    }
    if (invokeBestEffort(protocol, "web_app_setup_back_button", { is_visible: isVisible })) {
      store.set({ isVisible })
    }
  }

  const setVisible = (isVisible: boolean): void => {
    if (store.get().isVisible === isVisible) {
      return
    }
    postVisibility(isVisible)
  }

  return {
    feature: {
      supported,
      state: store,
      actions: {
        show: () => {
          setVisible(true)
        },
        hide: () => {
          setVisible(false)
        },
        onClick: (listener) => protocol.on("back_button_pressed", listener),
      },
    },
    // A native reload keeps its own back-button state, so sync reconciles it.
    sync: () => {
      postVisibility(store.get().isVisible)
    },
  }
}

export {
  createBackButton,
  type BackButtonActions,
  type BackButtonController,
  type BackButtonHandle,
  type BackButtonState,
}
