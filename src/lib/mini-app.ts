import type { TelegramRuntime } from "./telegram-runtime"

import { invokeBestEffort } from "./protocol/client"

type MiniApp = {
  ready: () => void
  setHeaderColor: (color: string) => void
  setBgColor: (color: string) => void
}

const createMiniApp = (runtime: TelegramRuntime): MiniApp => {
  const { protocol } = runtime
  const isReadySupported = protocol.supports("web_app_ready") !== "unsupported"

  return {
    ready: () => {
      if (isReadySupported) {
        invokeBestEffort(protocol, "web_app_ready")
      }
    },
    setHeaderColor: (color) => {
      invokeBestEffort(protocol, "web_app_set_header_color", { color })
    },
    setBgColor: (color) => {
      invokeBestEffort(protocol, "web_app_set_background_color", { color })
    },
  }
}

export { createMiniApp, type MiniApp }
