import type { Store } from "./store"

import { on } from "./events"
import { postEventBestEffort } from "./post-event"
import { createStore } from "./store"
import { supports } from "./version"

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

const createBackButton = (options: { version: string }): BackButton => {
  const isSupported = supports("web_app_setup_back_button", options.version)
  const store = createStore<BackButtonState>({ isVisible: false })

  const setVisible = (isVisible: boolean) => {
    if (!isSupported || store.get().isVisible === isVisible) {
      return
    }
    if (postEventBestEffort("web_app_setup_back_button", { is_visible: isVisible })) {
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
    onClick: (listener) => on("back_button_pressed", listener),
  }
}

export { createBackButton, type BackButton }
