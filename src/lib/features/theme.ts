import type { ThemeCssVariableTarget } from "#lib/features/theme/css-vars"
import type { TelegramRuntime } from "#lib/telegram-runtime"

import { bindThemeCssVariables } from "#lib/features/theme/css-vars"
import { invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./controller"

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

const HEX_COLOR_PATTERN = /^[0-9a-f]{6}$/iu

const parseHexColor = (value: string | undefined): readonly [number, number, number] | null => {
  if (value === undefined) {
    return null
  }
  const normalized = value.replaceAll(/[#\s]/gu, "")
  const hex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : normalized
  if (!HEX_COLOR_PATTERN.test(hex)) {
    return null
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

/**
 * Telegram's official script derives the scheme from `theme_params.bg_color`
 * with the HSP formula, so the client does not send `color_scheme`.
 */
const deriveColorScheme = (
  themeParams: Readonly<Record<string, string>>,
): ThemeColorScheme | null => {
  const rgb = parseHexColor(themeParams.bg_color)
  if (rgb === null) {
    return null
  }
  const [red, green, blue] = rgb
  const hsp = Math.sqrt(0.299 * red * red + 0.587 * green * green + 0.114 * blue * blue)
  return hsp < 120 ? "dark" : "light"
}

const createTheme = (runtime: TelegramRuntime): ThemeController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_request_theme")
  const store = createStore<ThemeState>(initialThemeState)

  runtime.disposer.add(
    protocol.on("theme_changed", (payload) => {
      store.set({
        themeParams: payload.theme_params,
        colorScheme: deriveColorScheme(payload.theme_params),
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
