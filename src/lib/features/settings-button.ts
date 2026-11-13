import type { TelegramRuntime } from "#lib/telegram-runtime"

import { invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./controller"

type SettingsButtonState = {
  isVisible: boolean
}

type SettingsButtonActions = {
  /** Merges the partial state; `isVisible` is the only settings-button field. */
  set: (partial: Partial<SettingsButtonState>) => void
  show: () => void
  hide: () => void
  onClick: (listener: () => void) => () => void
}

type SettingsButtonController = FeatureController<SettingsButtonState, SettingsButtonActions>

const createSettingsButton = (runtime: TelegramRuntime): SettingsButtonController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_setup_settings_button")
  const store = createStore<SettingsButtonState>({ isVisible: false })

  const setVisible = (isVisible: boolean): void => {
    if (!supported || store.get().isVisible === isVisible) {
      return
    }
    if (invokeBestEffort(protocol, "web_app_setup_settings_button", { is_visible: isVisible })) {
      store.set({ isVisible })
    }
  }

  return {
    supported,
    state: store,
    actions: {
      set: (partial) => {
        if (partial.isVisible !== undefined) {
          setVisible(partial.isVisible)
        }
      },
      show: () => {
        setVisible(true)
      },
      hide: () => {
        setVisible(false)
      },
      onClick: (listener) => protocol.on("settings_button_pressed", listener),
    },
  }
}

export {
  createSettingsButton,
  type SettingsButtonActions,
  type SettingsButtonController,
  type SettingsButtonState,
}
