import { invokeBestEffort } from "#lib/protocol/client"

import type { Store } from "./store"
import type { TelegramRuntime } from "./telegram-runtime"

import { createStore } from "./store"

type BackButtonState = {
  isVisible: boolean
}

type BackButton = {
  isSupported: boolean
  store: Store<BackButtonState>
  sync: () => void
  show: () => void
  hide: () => void
  onClick: (listener: () => void) => () => void
}

const createBackButton = (runtime: TelegramRuntime): BackButton => {
  const { protocol } = runtime
  const isSupported = protocol.mayInvoke("web_app_setup_back_button")
  const store = createStore<BackButtonState>({ isVisible: false })

  const postVisibility = (isVisible: boolean) => {
    if (!isSupported) {
      return
    }
    if (invokeBestEffort(protocol, "web_app_setup_back_button", { is_visible: isVisible })) {
      store.set({ isVisible })
    }
  }

  const setVisible = (isVisible: boolean) => {
    if (store.get().isVisible === isVisible) {
      return
    }
    postVisibility(isVisible)
  }

  return {
    isSupported,
    store,
    // A native reload keeps its own back-button state, so sync reconciles it.
    sync: () => {
      postVisibility(store.get().isVisible)
    },
    show: () => {
      setVisible(true)
    },
    hide: () => {
      setVisible(false)
    },
    onClick: (listener) => protocol.on("back_button_pressed", listener),
  }
}

export { createBackButton, type BackButton }
