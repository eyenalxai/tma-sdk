import type { BackButtonController, BackButtonHandle } from "./back-button"
import type { DownloadsController } from "./download-file"
import type { ClipboardController } from "./features/clipboard"
import type { ClosingBehaviorController } from "./features/closing-behavior"
import type { DialogsController } from "./features/dialogs"
import type { MainButtonController } from "./features/main-button"
import type { SecondaryButtonController } from "./features/secondary-button"
import type { SettingsButtonController } from "./features/settings-button"
import type { ThemeController } from "./features/theme"
import type { HapticsController } from "./haptic-feedback"
import type { LinksController } from "./links"
import type { WriteAccessController } from "./request-write-access"
import type { SwipeBehaviorController } from "./swipe-behavior"
import type { TelegramRuntime } from "./telegram-runtime"
import type { ViewportController, ViewportHandle } from "./viewport"

import { createBackButton } from "./back-button"
import { createDownloads } from "./download-file"
import { createClipboard } from "./features/clipboard"
import { createClosingBehavior } from "./features/closing-behavior"
import { createDialogs } from "./features/dialogs"
import { createMainButton } from "./features/main-button"
import { createSecondaryButton } from "./features/secondary-button"
import { createSettingsButton } from "./features/settings-button"
import { createTheme } from "./features/theme"
import { createHaptics } from "./haptic-feedback"
import { createLinks } from "./links"
import { createWriteAccess } from "./request-write-access"
import { createSwipeBehavior } from "./swipe-behavior"
import { createViewport } from "./viewport"

type Features = {
  theme: ThemeController
  viewport: ViewportController
  backButton: BackButtonController
  mainButton: MainButtonController
  secondaryButton: SecondaryButtonController
  settingsButton: SettingsButtonController
  closingBehavior: ClosingBehaviorController
  swipeBehavior: SwipeBehaviorController
  haptics: HapticsController
  links: LinksController
  downloads: DownloadsController
  writeAccess: WriteAccessController
  dialogs: DialogsController
  clipboard: ClipboardController
}

type SessionFeatures = {
  features: Features
  /** Session-owned: mounts the viewport and requests its initial state. */
  mountViewport: ViewportHandle["mount"]
  /** Session-owned: reconciles the native back button with the stored state. */
  syncBackButton: BackButtonHandle["sync"]
  /** Session-owned: binds the viewport, safe-area and theme CSS variables. */
  bindCssVars: () => () => void
}

const createFeatures = (
  runtime: TelegramRuntime,
  options: { platform: string; isFullscreen: boolean },
): SessionFeatures => {
  const viewport = createViewport(runtime, options)
  const backButton = createBackButton(runtime)
  const theme = createTheme(runtime)

  return {
    features: {
      theme,
      viewport: viewport.feature,
      backButton: backButton.feature,
      mainButton: createMainButton(runtime),
      secondaryButton: createSecondaryButton(runtime),
      settingsButton: createSettingsButton(runtime),
      closingBehavior: createClosingBehavior(runtime),
      swipeBehavior: createSwipeBehavior(runtime),
      haptics: createHaptics(runtime),
      links: createLinks(runtime),
      downloads: createDownloads(runtime),
      writeAccess: createWriteAccess(runtime),
      dialogs: createDialogs(runtime),
      clipboard: createClipboard(runtime),
    },
    mountViewport: viewport.mount,
    syncBackButton: backButton.sync,
    bindCssVars: () => {
      const unbindViewport = viewport.bindCssVars()
      const unbindTheme = theme.actions.bindCssVars()
      return () => {
        unbindViewport()
        unbindTheme()
      }
    },
  }
}

export { createFeatures, type Features, type SessionFeatures }
