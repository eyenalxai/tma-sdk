import { postEvent, postEventBestEffort } from "./post-event"
import { supports, supportsParam } from "./version"

type MiniApp = {
  ready: () => void
  setHeaderColor: (color: string) => void
  setBgColor: (color: string) => void
}

const createMiniApp = (options: { version: string }): MiniApp => {
  const { version } = options

  return {
    ready: () => {
      postEvent("web_app_ready")
    },
    setHeaderColor: (color) => {
      // RGB header colors require Mini Apps 6.9+.
      if (supportsParam("web_app_set_header_color.color", version)) {
        postEventBestEffort("web_app_set_header_color", { color })
      }
    },
    setBgColor: (color) => {
      if (supports("web_app_set_background_color", version)) {
        postEventBestEffort("web_app_set_background_color", { color })
      }
    },
  }
}

export { createMiniApp, type MiniApp }
