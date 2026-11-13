import type { TelegramRuntime } from "#lib/telegram-runtime"

import { invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./controller"
import type { ThemeCssVariableTarget } from "./theme-css-vars"

import { bindThemeCssVariables } from "./theme-css-vars"

type ThemeColorScheme = "light" | "dark"

type ThemeState = {
  themeParams: Readonly<Record<string, string>>
  colorScheme: ThemeColorScheme | null
}

type ThemeActions = {
  /** Requests a fresh `theme_changed` payload and resolves with the stored theme. */
  request: () => Promise<ThemeState>
  /** Binds `--tg-theme-*` and `--tg-color-scheme` to the document root. */
  bindCssVars: (target?: ThemeCssVariableTarget) => () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  setBottomBarColor: (color: string) => void
}

type ThemeController = FeatureController<ThemeState, ThemeActions>

const initialThemeState: ThemeState = {
  themeParams: {},
  colorScheme: null,
}

const createTheme = (runtime: TelegramRuntime): ThemeController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_request_theme")
  const store = createStore<ThemeState>(initialThemeState)

  runtime.disposer.add(
    protocol.on("theme_changed", (payload) => {
      store.set({
        themeParams: payload.theme_params,
        colorScheme: payload.color_scheme ?? null,
      })
    }),
  )

  return {
    supported,
    state: store,
    actions: {
      request: async () => {
        if (!supported) {
          throw new Error("Theme requests are not supported in this Telegram version")
        }
        await protocol.request({ method: ["web_app_request_theme"] })
        return store.get()
      },
      bindCssVars: (target) => bindThemeCssVariables(store, target),
      setHeaderColor: (color) => {
        // RGB header colors require Mini Apps 6.9+.
        if (protocol.supportsParam("web_app_set_header_color", "color")) {
          invokeBestEffort(protocol, "web_app_set_header_color", { color })
        }
      },
      setBackgroundColor: (color) => {
        if (protocol.mayInvoke("web_app_set_background_color")) {
          invokeBestEffort(protocol, "web_app_set_background_color", { color })
        }
      },
      setBottomBarColor: (color) => {
        if (protocol.mayInvoke("web_app_set_bottom_bar_color")) {
          invokeBestEffort(protocol, "web_app_set_bottom_bar_color", { color })
        }
      },
    },
  }
}

export {
  createTheme,
  initialThemeState,
  type ThemeActions,
  type ThemeColorScheme,
  type ThemeController,
  type ThemeState,
}
