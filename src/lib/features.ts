import type { ClipboardController } from "#lib/features/clipboard"
import type { ClosingBehaviorController } from "#lib/features/closing-behavior"
import type { DialogsController } from "#lib/features/dialogs"
import type { MainButtonController } from "#lib/features/main-button"
import type { SecondaryButtonController } from "#lib/features/secondary-button"
import type { SettingsButtonController } from "#lib/features/settings-button"
import type { ThemeController } from "#lib/features/theme"

import { createClipboard } from "#lib/features/clipboard"
import { createClosingBehavior } from "#lib/features/closing-behavior"
import { createDialogs } from "#lib/features/dialogs"
import { createMainButton } from "#lib/features/main-button"
import { createSecondaryButton } from "#lib/features/secondary-button"
import { createSettingsButton } from "#lib/features/settings-button"
import { createTheme } from "#lib/features/theme"

import type { BackButtonController, BackButtonHandle } from "./back-button"
import type { DownloadsController } from "./download-file"
import type { HapticsController } from "./haptic-feedback"
import type { LinksController } from "./links"
import type { WriteAccessController } from "./request-write-access"
import type { SwipeBehaviorController } from "./swipe-behavior"
import type { TelegramRuntime } from "./telegram-runtime"
import type { ViewportController, ViewportHandle } from "./viewport"

import { createBackButton } from "./back-button"
import { createDownloads } from "./download-file"
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
