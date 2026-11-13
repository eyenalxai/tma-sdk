import { invokeBestEffort } from "#lib/protocol/client"

import type { TelegramRuntime } from "./telegram-runtime"

type MiniApp = {
  ready: () => void
  setHeaderColor: (color: string) => void
  setBgColor: (color: string) => void
}

const createMiniApp = (runtime: TelegramRuntime): MiniApp => {
  const { protocol } = runtime
  const isReadySupported = protocol.canInvoke("web_app_ready")

  return {
    ready: () => {
      if (isReadySupported) {
        invokeBestEffort(protocol, "web_app_ready")
      }
    },
    setHeaderColor: (color) => {
      // RGB header colors require Mini Apps 6.9+.
      if (protocol.supportsParam("web_app_set_header_color", "color")) {
        invokeBestEffort(protocol, "web_app_set_header_color", { color })
      }
    },
    setBgColor: (color) => {
      invokeBestEffort(protocol, "web_app_set_background_color", { color })
    },
  }
}

export { createMiniApp, type MiniApp }
