import { request } from "./request"
import { supports } from "./version"

/**
 * Displays a native popup prompting the user to download a file.
 * @since Mini Apps v8.0
 */
const createDownloadFile =
  (options: { version: string; signal: AbortSignal }) =>
  async (url: string, fileName: string): Promise<void> => {
    if (!supports("web_app_request_file_download", options.version)) {
      throw new Error("File download is not supported in this Telegram version")
    }

    const { payload } = await request({
      method: ["web_app_request_file_download", { url, file_name: fileName }],
      events: ["file_download_requested"],
      signal: options.signal,
    })

    if (payload.status !== "downloading") {
      throw new Error("User denied the file download")
    }
  }

export { createDownloadFile }
