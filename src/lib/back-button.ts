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
  show: () => void
  hide: () => void
  onClick: (listener: () => void) => () => void
}

const createBackButton = (runtime: TelegramRuntime): BackButton => {
  const { protocol } = runtime
  const isSupported = protocol.canInvoke("web_app_setup_back_button")
  const store = createStore<BackButtonState>({ isVisible: false })

  const setVisible = (isVisible: boolean) => {
    if (!isSupported || store.get().isVisible === isVisible) {
      return
    }
    if (invokeBestEffort(protocol, "web_app_setup_back_button", { is_visible: isVisible })) {
      store.set({ isVisible })
    }
  }

  return {
    isSupported,
    store,
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
