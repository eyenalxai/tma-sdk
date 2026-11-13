import type { PopupButton, PopupParams } from "#lib/protocol/methods"
import type { TelegramRuntime } from "#lib/telegram-runtime"

import { USER_CONFIRMATION_TIMEOUT_MS } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./controller"

type DialogButton = PopupButton

type DialogOptions = PopupParams

type DialogsState = {
  isOpen: boolean
}

type DialogsActions = {
  /** Opens a native popup and resolves with the pressed button id, or null. */
  show: (options: DialogOptions) => Promise<string | null>
  /** Opens a popup with one OK button and resolves when it closes. */
  alert: (message: string) => Promise<void>
  /** Opens a popup with OK and Cancel buttons and resolves true only for OK. */
  confirm: (message: string) => Promise<boolean>
}

type DialogsController = FeatureController<DialogsState, DialogsActions>

const createDialogs = (runtime: TelegramRuntime): DialogsController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_open_popup")
  const store = createStore<DialogsState>({ isOpen: false })
  let openDialogs = 0

  const show = async (options: DialogOptions): Promise<string | null> => {
    if (!supported) {
      throw new Error("Dialogs are not supported in this Telegram version")
    }

    openDialogs += 1
    store.set({ isOpen: true })
    try {
      const { payload } = await protocol.request({
        method: ["web_app_open_popup", options],
        timeout: USER_CONFIRMATION_TIMEOUT_MS,
      })
      return payload.button_id ?? null
    } finally {
      openDialogs -= 1
      store.set({ isOpen: openDialogs > 0 })
    }
  }

  return {
    supported,
    state: store,
    actions: {
      show,
      alert: async (message) => {
        await show({ message, buttons: [{ type: "ok" }] })
      },
      confirm: async (message) => {
        const buttonId = await show({
          message,
          buttons: [
            { id: "ok", type: "ok" },
            { id: "cancel", type: "cancel" },
          ],
        })
        return buttonId === "ok"
      },
    },
  }
}

export {
  createDialogs,
  type DialogButton,
  type DialogOptions,
  type DialogsActions,
  type DialogsController,
  type DialogsState,
}
