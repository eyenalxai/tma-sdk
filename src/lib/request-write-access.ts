import type { FeatureController } from "#lib/features/controller"
import type { TelegramRuntime } from "#lib/telegram-runtime"

import { USER_CONFIRMATION_TIMEOUT_MS } from "#lib/protocol/client"
import { createStore } from "#lib/store"

type WriteAccessStatus = "allowed" | "cancelled"

type WriteAccessState = {
  status: WriteAccessStatus | null
}

type WriteAccessActions = {
  /** Requests write message access and resolves with the reported status. */
  request: () => Promise<WriteAccessStatus>
}

type WriteAccessController = FeatureController<WriteAccessState, WriteAccessActions>

/**
 * Requests write message access to the current user.
 * @since Mini Apps v6.9
 */
const createWriteAccess = (runtime: TelegramRuntime): WriteAccessController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_request_write_access")
  const store = createStore<WriteAccessState>({ status: null })

  return {
    supported,
    state: store,
    actions: {
      request: async () => {
        if (!supported) {
          throw new Error("Write access requests are not supported in this Telegram version")
        }

        const { payload } = await protocol.request({
          method: ["web_app_request_write_access"],
          timeout: USER_CONFIRMATION_TIMEOUT_MS,
        })

        store.set({ status: payload.status })
        return payload.status
      },
    },
  }
}

export {
  createWriteAccess,
  type WriteAccessActions,
  type WriteAccessController,
  type WriteAccessState,
  type WriteAccessStatus,
}
