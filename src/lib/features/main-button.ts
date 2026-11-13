import type { TelegramRuntime } from "#lib/telegram-runtime"

import type { BottomButtonActions, BottomButtonState } from "./bottom-button"
import type { FeatureController } from "./controller"

import { createBottomButton, visibleButtonParams } from "./bottom-button"

type MainButtonState = BottomButtonState

type MainButtonActions = BottomButtonActions<MainButtonState>

type MainButtonController = FeatureController<MainButtonState, MainButtonActions>

const initialMainButtonState: MainButtonState = {
  isVisible: false,
  isActive: true,
  isProgressVisible: false,
  text: "Continue",
  hasShineEffect: false,
}

const createMainButton = (runtime: TelegramRuntime): MainButtonController =>
  createBottomButton(runtime, {
    initial: initialMainButtonState,
    method: "web_app_setup_main_button",
    event: "main_button_pressed",
    toParams: visibleButtonParams,
  })

export {
  createMainButton,
  initialMainButtonState,
  type MainButtonActions,
  type MainButtonController,
  type MainButtonState,
}
