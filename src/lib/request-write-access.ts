import type { TelegramRuntime } from "./telegram-runtime"

import { USER_CONFIRMATION_TIMEOUT_MS } from "./request"
import { supports } from "./version"

type WriteAccessStatus = "allowed" | "cancelled"

/**
 * Requests write message access to the current user.
 * @returns The status reported by the Telegram client ("allowed" or "cancelled").
 * @since Mini Apps v6.9
 */
const createRequestWriteAccess =
  (runtime: TelegramRuntime) => async (): Promise<WriteAccessStatus> => {
    if (!supports("web_app_request_write_access", runtime.version)) {
      throw new Error("Write access requests are not supported in this Telegram version")
    }

    const { payload } = await runtime.request({
      method: ["web_app_request_write_access"],
      events: ["write_access_requested"],
      timeout: USER_CONFIRMATION_TIMEOUT_MS,
    })

    return payload.status
  }

export { createRequestWriteAccess, type WriteAccessStatus }
