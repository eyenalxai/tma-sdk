import type { TelegramRuntime } from "#lib/telegram-runtime"

import { USER_CONFIRMATION_TIMEOUT_MS } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./features/controller"

type DownloadStatus = "downloading" | "cancelled"

type DownloadsState = {
  status: DownloadStatus | null
}

type DownloadsActions = {
  /** Asks Telegram to download the file and resolves with the reported status. */
  request: (url: string, fileName: string) => Promise<DownloadStatus>
}

type DownloadsController = FeatureController<DownloadsState, DownloadsActions>

/**
 * Displays a native popup prompting the user to download a file.
 * A cancelled download is a status, not an error.
 * @since Mini Apps v8.0
 */
const createDownloads = (runtime: TelegramRuntime): DownloadsController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_request_file_download")
  const store = createStore<DownloadsState>({ status: null })

  return {
    supported,
    state: store,
    actions: {
      request: async (url, fileName) => {
        if (!supported) {
          throw new Error("File downloads are not supported in this Telegram version")
        }

        const { payload } = await protocol.request({
          method: ["web_app_request_file_download", { url, file_name: fileName }],
          timeout: USER_CONFIRMATION_TIMEOUT_MS,
        })

        store.set({ status: payload.status })
        return payload.status
      },
    },
  }
}

export {
  createDownloads,
  type DownloadStatus,
  type DownloadsActions,
  type DownloadsController,
  type DownloadsState,
}
