import { request } from "./request"
import { supports } from "./version"

type WriteAccessStatus = "allowed" | "cancelled"

/**
 * Requests write message access to the current user.
 * @returns The status reported by the Telegram client ("allowed" or "cancelled").
 * @since Mini Apps v6.9
 */
const createRequestWriteAccess =
  (options: { version: string; signal: AbortSignal }) => async (): Promise<WriteAccessStatus> => {
    if (!supports("web_app_request_write_access", options.version)) {
      throw new Error("Write access requests are not supported in this Telegram version")
    }

    const { payload } = await request({
      method: ["web_app_request_write_access"],
      events: ["write_access_requested"],
      signal: options.signal,
    })

    return payload.status
  }

export { createRequestWriteAccess, type WriteAccessStatus }
