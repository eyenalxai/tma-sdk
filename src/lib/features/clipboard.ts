import type { TelegramRuntime } from "#lib/telegram-runtime"

import { USER_CONFIRMATION_TIMEOUT_MS } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./controller"

type ClipboardState = {
  text: string | null
}

type ClipboardActions = {
  /** Reads the clipboard through Telegram and resolves with its text, or null. */
  read: () => Promise<string | null>
}

type ClipboardController = FeatureController<ClipboardState, ClipboardActions>

let requestCounter = 0

const createRequestId = (): string => {
  requestCounter += 1
  return `clipboard-${requestCounter}`
}

const createClipboard = (runtime: TelegramRuntime): ClipboardController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_read_text_from_clipboard")
  const store = createStore<ClipboardState>({ text: null })

  return {
    supported,
    state: store,
    actions: {
      read: async () => {
        if (!supported) {
          throw new Error("Clipboard reads are not supported in this Telegram version")
        }

        const { payload } = await protocol.request({
          method: ["web_app_read_text_from_clipboard", { req_id: createRequestId() }],
          timeout: USER_CONFIRMATION_TIMEOUT_MS,
        })

        const text = payload.data ?? null
        store.set({ text })
        return text
      },
    },
  }
}

export { createClipboard, type ClipboardActions, type ClipboardController, type ClipboardState }
