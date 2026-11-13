import type { TelegramRuntime } from "./telegram-runtime"

import { USER_CONFIRMATION_TIMEOUT_MS } from "./protocol/client"

/**
 * Displays a native popup prompting the user to download a file.
 * @since Mini Apps v8.0
 */
const createDownloadFile =
  (runtime: TelegramRuntime) =>
  async (url: string, fileName: string): Promise<void> => {
    const { protocol } = runtime
    if (protocol.supports("web_app_request_file_download") === "unsupported") {
      throw new Error("File download is not supported in this Telegram version")
    }

    const { payload } = await protocol.request({
      method: ["web_app_request_file_download", { url, file_name: fileName }],
      timeout: USER_CONFIRMATION_TIMEOUT_MS,
    })

    if (payload.status !== "downloading") {
      throw new Error("User denied the file download")
    }
  }

export { createDownloadFile }
